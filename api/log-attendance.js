import { google } from 'googleapis';

// Configuration
const MATCH_QR_STRING = "f29cZb7Q6DuaMjYkTLV3nxR9KEqV2XoBslrHcwA8d1tZ5UeqgiWTvjNpLEsQ";

// Helper functions for date and time
function getTodayDate() {
  const now = new Date();
  return now.toISOString().slice(0, 10); // yyyy-mm-dd format
}

function getNowTime() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

// Debug helper
function logDebug(message, data) {
  console.log(`[DEBUG] ${message}`, data);
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Log incoming request for debugging
  logDebug('Received request', { method: req.method, body: req.body });
  
  if (req.method !== 'POST') {
    logDebug('Method not allowed', req.method);
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  try {
    // Validate environment variables
    if (!process.env.GOOGLE_SERVICE_ACCOUNT) {
      logDebug('Missing GOOGLE_SERVICE_ACCOUNT environment variable');
      return res.status(500).json({ status: 'error', message: 'Server configuration error' });
    }
    
    if (!process.env.GOOGLE_SHEET_ID) {
      logDebug('Missing GOOGLE_SHEET_ID environment variable');
      return res.status(500).json({ status: 'error', message: 'Server configuration error' });
    }
    
    // Parse service account and get sheet ID
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const sheetId = process.env.GOOGLE_SHEET_ID;
    
    logDebug('Using sheet ID', sheetId);
    
    // Initialize Google Sheets API
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    // Extract request data
    const { action, fullName, mobile, employeeId, department, location } = req.body;
    logDebug('Request data', { action, employeeId, fullName });
    
    // Validate required fields
    if (!action) {
      logDebug('Missing action parameter');
      return res.status(400).json({ status: 'error', message: 'Missing action parameter' });
    }
    
    if (!employeeId && action !== 'register' && action !== 'validate-qr') {
      logDebug('Missing employeeId parameter');
      return res.status(400).json({ status: 'error', message: 'Missing employeeId parameter' });
    }
    
    const today = getTodayDate();

    // 1. Read all rows with error handling
    let rows = [];
    try {
      const getRows = await sheets.spreadsheets.values.get({
        spreadsheetId: sheetId,
        range: 'Sheet1', // Change if your tab is named differently
      });
      rows = getRows.data.values || [];
      logDebug('Retrieved rows from sheet', { rowCount: rows.length });
    } catch (sheetError) {
      logDebug('Error reading sheet', sheetError);
      return res.status(500).json({ 
        status: 'error', 
        message: 'Failed to access attendance sheet. Please check sheet permissions.' 
      });
    }

    // If sheet is empty, create header row
    if (rows.length === 0) {
      logDebug('Sheet is empty, creating header row');
      const headerRow = [
        'Full Name', 'Mobile', 'Employee ID', 'Department', 'Date', 
        'Check-in Time', 'Check-in Location', 'Check-out Time', 'Check-out Location'
      ];
      
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Sheet1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [headerRow] }
      });
      
      // Re-fetch rows to get the header
      try {
        const updatedRows = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'Sheet1',
        });
        rows = updatedRows.data.values || [];
      } catch (refetchError) {
        logDebug('Error re-fetching rows after header creation', refetchError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to initialize attendance sheet' 
        });
      }
    }

    // Define header and column indices
    const header = rows[0] || [];
    logDebug('Sheet header', header);
    
    const nameIdx = header.indexOf('Full Name');
    const mobileIdx = header.indexOf('Mobile');
    const idIdx = header.indexOf('Employee ID');
    const deptIdx = header.indexOf('Department');
    const dateIdx = header.indexOf('Date');
    const checkInIdx = header.indexOf('Check-in Time');
    const checkInLocIdx = header.indexOf('Check-in Location');
    const checkOutIdx = header.indexOf('Check-out Time');
    const checkOutLocIdx = header.indexOf('Check-out Location');
    
    // Validate header structure
    if (idIdx === -1 || dateIdx === -1 || checkInIdx === -1 || checkOutIdx === -1) {
      logDebug('Invalid sheet structure', { idIdx, dateIdx, checkInIdx, checkOutIdx });
      return res.status(500).json({ 
        status: 'error', 
        message: 'Sheet structure is invalid. Please check column headers.' 
      });
    }

    // Find if the user is registered (exists in any row, any date)
    let isRegistered = false;
    let registeredUserData = null;
    
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx] === employeeId) {
        isRegistered = true;
        registeredUserData = {
          fullName: rows[i][nameIdx] || '',
          mobile: rows[i][mobileIdx] || '',
          employeeId: rows[i][idIdx] || '',
          department: rows[i][deptIdx] || ''
        };
        break;
      }
    }
    
    logDebug('User registration status', { isRegistered, employeeId, registeredUserData });

    // Find row for this employeeId and today
    let userRowIdx = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx] === employeeId && rows[i][dateIdx] === today) {
        userRowIdx = i;
        break;
      }
    }
    
    logDebug('User row for today', { userRowIdx, today });

    // --- Registration ---
    if (action === 'register') {
      logDebug('Processing registration', { fullName, employeeId });
      
      // If user is already registered (in any row), do not register again
      if (isRegistered) {
        logDebug('User already exists', { employeeId });
        return res.status(200).json({ 
          status: 'exists', 
          message: 'User already registered',
          userData: registeredUserData
        });
      }
      
      // Validate required fields
      if (!fullName || !mobile || !employeeId || !department) {
        logDebug('Missing required fields', { fullName, mobile, employeeId, department });
        return res.status(400).json({ 
          status: 'error', 
          message: 'Missing required fields for registration' 
        });
      }
      
      // Append new row for today
      const newRow = [
        fullName || '',
        mobile || '',
        employeeId || '',
        department || '',
        today,
        '', // check-in time
        '', // check-in location
        '', // check-out time
        '', // check-out location
      ];
      
      logDebug('Appending new user row', newRow);
      
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: sheetId,
          range: 'Sheet1',
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [newRow] }
        });
        
        logDebug('Registration successful');
        return res.status(200).json({ 
          status: 'success', 
          message: 'Registration successful',
          userData: {
            fullName,
            mobile,
            employeeId,
            department
          }
        });
      } catch (appendError) {
        logDebug('Error appending row', appendError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to register user: ' + appendError.message 
        });
      }
    }

    // --- Check-in ---
    if (action === 'check-in') {
      logDebug('Processing check-in', { employeeId, location });
      
      // Only allow check-in if user is registered
      if (!isRegistered) {
        logDebug('User not registered', { employeeId });
        return res.status(400).json({ 
          status: 'error', 
          message: 'User not registered. Please register first.' 
        });
      }
      
      // If no row for today, append a new row for today
      if (userRowIdx === -1) {
        logDebug('No row for today, creating new row', { employeeId, today });
        
        // Use the registered user data to create a complete row
        const newRow = [
          registeredUserData.fullName || '',
          registeredUserData.mobile || '',
          employeeId,
          registeredUserData.department || '',
          today,
          '', // check-in time
          '', // check-in location
          '', // check-out time
          '', // check-out location
        ];
        
        try {
          await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: 'Sheet1',
            valueInputOption: 'USER_ENTERED',
            requestBody: { values: [newRow] }
          });
          
          // Re-fetch rows to get the new row index
          try {
            const getRows2 = await sheets.spreadsheets.values.get({
              spreadsheetId: sheetId,
              range: 'Sheet1',
            });
            const rows2 = getRows2.data.values || [];
            userRowIdx = rows2.length - 1;
            logDebug('Created new row for today', { userRowIdx });
          } catch (refetchError) {
            logDebug('Error re-fetching rows after creating new row', refetchError);
            return res.status(500).json({ 
              status: 'error', 
              message: 'Failed to create attendance record' 
            });
          }
        } catch (appendError) {
          logDebug('Error creating row for today', appendError);
          return res.status(500).json({ 
            status: 'error', 
            message: 'Failed to create attendance record: ' + appendError.message 
          });
        }
      }
      
      // Re-fetch the current row to ensure we have the latest data
      let row = [];
      try {
        const getRows3 = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `Sheet1!${userRowIdx + 1}:${userRowIdx + 1}`,
        });
        row = getRows3.data.values?.[0] || [];
      } catch (rowFetchError) {
        logDebug('Error fetching current row data', rowFetchError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to verify attendance record' 
        });
      }
      
      // Check if already checked in
      if (row[checkInIdx]) {
        logDebug('Already checked in', { checkInTime: row[checkInIdx] });
        return res.status(400).json({ 
          status: 'error', 
          message: 'Already checked in for today.' 
        });
      }
      
      // Update check-in time and location
      const checkInTime = getNowTime();
      const checkInLocation = location ? `${location.latitude},${location.longitude}` : '';
      
      logDebug('Updating check-in data', { checkInTime, checkInLocation });
      
      try {
        const updateRange = `Sheet1!${String.fromCharCode(65 + checkInIdx)}${userRowIdx + 1}:${String.fromCharCode(65 + checkInLocIdx)}${userRowIdx + 1}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: updateRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[checkInTime, checkInLocation]] }
        });
        
        logDebug('Check-in successful', { checkInTime });
        return res.status(200).json({ status: 'success', time: checkInTime });
      } catch (updateError) {
        logDebug('Error updating check-in', updateError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to update check-in: ' + updateError.message 
        });
      }
    }

    // --- Check-out ---
    if (action === 'check-out') {
      logDebug('Processing check-out', { employeeId, location });
      
      if (!isRegistered) {
        logDebug('User not registered', { employeeId });
        return res.status(400).json({ 
          status: 'error', 
          message: 'User not registered. Please register first.' 
        });
      }
      
      if (userRowIdx === -1) {
        logDebug('No attendance record for today', { employeeId, today });
        return res.status(400).json({ 
          status: 'error', 
          message: 'No attendance record for today. Please check in first.' 
        });
      }
      
      // Re-fetch the current row to ensure we have the latest data
      let row = [];
      try {
        const getRowData = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `Sheet1!${userRowIdx + 1}:${userRowIdx + 1}`,
        });
        row = getRowData.data.values?.[0] || [];
      } catch (rowFetchError) {
        logDebug('Error fetching current row data for checkout', rowFetchError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to verify attendance record' 
        });
      }
      
      if (!row[checkInIdx]) {
        logDebug('No check-in record found', { employeeId, today });
        return res.status(400).json({ 
          status: 'error', 
          message: 'Please check-in first.' 
        });
      }
      
      if (row[checkOutIdx]) {
        logDebug('Already checked out', { checkOutTime: row[checkOutIdx] });
        return res.status(400).json({ 
          status: 'error', 
          message: 'Already checked out for today.' 
        });
      }
      
      // Update check-out time and location
      const checkOutTime = getNowTime();
      const checkOutLocation = location ? `${location.latitude},${location.longitude}` : '';
      
      logDebug('Updating check-out data', { checkOutTime, checkOutLocation });
      
      try {
        const updateRange = `Sheet1!${String.fromCharCode(65 + checkOutIdx)}${userRowIdx + 1}:${String.fromCharCode(65 + checkOutLocIdx)}${userRowIdx + 1}`;
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: updateRange,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[checkOutTime, checkOutLocation]] }
        });
        
        logDebug('Check-out successful', { checkOutTime });
        return res.status(200).json({ status: 'success', time: checkOutTime });
      } catch (updateError) {
        logDebug('Error updating check-out', updateError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to update check-out: ' + updateError.message 
        });
      }
    }

    // --- Status ---
    if (action === 'status') {
      logDebug('Processing status check', { employeeId });
      
      if (!isRegistered) {
        logDebug('User not registered', { employeeId });
        return res.status(200).json({ status: 'not_registered' });
      }
      
      if (userRowIdx === -1) {
        logDebug('No attendance record for today', { employeeId, today });
        return res.status(200).json({ status: 'not_checked_in' });
      }
      
      // Re-fetch the current row to ensure we have the latest data
      let row = [];
      try {
        const getRowData = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: `Sheet1!${userRowIdx + 1}:${userRowIdx + 1}`,
        });
        row = getRowData.data.values?.[0] || [];
      } catch (rowFetchError) {
        logDebug('Error fetching current row data for status', rowFetchError);
        return res.status(500).json({ 
          status: 'error', 
          message: 'Failed to verify attendance record' 
        });
      }
      
      if (!row[checkInIdx]) {
        logDebug('No check-in record found', { employeeId, today });
        return res.status(200).json({ status: 'not_checked_in' });
      }
      
      if (row[checkInIdx] && !row[checkOutIdx]) {
        logDebug('User checked in but not out', { checkInTime: row[checkInIdx] });
        return res.status(200).json({ 
          status: 'checked_in', 
          check_in_time: row[checkInIdx] 
        });
      }
      
      if (row[checkInIdx] && row[checkOutIdx]) {
        logDebug('User completed attendance', { 
          checkInTime: row[checkInIdx], 
          checkOutTime: row[checkOutIdx] 
        });
        return res.status(200).json({ 
          status: 'completed', 
          check_in_time: row[checkInIdx], 
          check_out_time: row[checkOutIdx] 
        });
      }
    }

    // --- QR Validation ---
    if (action === 'validate-qr') {
      logDebug('Processing QR validation', { qrCode: req.body.qrCode });
      
      const { qrCode } = req.body;
      if (!qrCode) {
        logDebug('Missing QR code for validation');
        return res.status(400).json({ 
          status: 'error', 
          message: 'Missing QR code for validation' 
        });
      }
      
      if (qrCode === MATCH_QR_STRING) {
        logDebug('QR code validation successful');
        return res.status(200).json({ 
          status: 'valid', 
          message: 'QR code is valid' 
        });
      } else {
        logDebug('QR code validation failed', { received: qrCode, expected: MATCH_QR_STRING });
        return res.status(200).json({ 
          status: 'invalid', 
          message: 'Invalid QR code. Please scan the authorized QR code.' 
        });
      }
    }

    // --- Unknown action ---
    logDebug('Unknown action requested', { action });
    return res.status(400).json({ 
      status: 'error', 
      message: 'Unknown action' 
    });

  } catch (err) {
    console.error('API error:', err);
    logDebug('API error', err);
    res.status(500).json({ 
      status: 'error', 
      message: 'Server error: ' + err.message 
    });
  }
}
