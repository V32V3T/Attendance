import { google } from 'googleapis';

function getTodayDate() {
  const now = new Date();
  return now.toISOString().slice(0, 10); // yyyy-mm-dd
}
function getNowTime() {
  return new Date().toLocaleTimeString('en-GB', { hour12: false });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT);
    const sheetId = process.env.GOOGLE_SHEET_ID;
    const auth = new google.auth.GoogleAuth({
      credentials: serviceAccount,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });

    const { action, fullName, mobile, employeeId, department, location } = req.body;
    const today = getTodayDate();

    // 1. Read all rows
    const getRows = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'Sheet1', // Change if your tab is named differently
    });
    const rows = getRows.data.values || [];

    // Find row for this employeeId and today
    const header = rows[0] || [];
    const idIdx = header.indexOf('Employee ID');
    const dateIdx = header.indexOf('Date');
    // Adjust indices for removed Day Type column
    const checkInIdx = header.indexOf('Check-in Time');
    const checkInLocIdx = header.indexOf('Check-in Location');
    const checkOutIdx = header.indexOf('Check-out Time');
    const checkOutLocIdx = header.indexOf('Check-out Location');

    let userRowIdx = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][idIdx] === employeeId && rows[i][dateIdx] === today) {
        userRowIdx = i;
        break;
      }
    }

    // --- Registration ---
    if (action === 'register') {
      if (userRowIdx !== -1) {
        return res.status(200).json({ status: 'exists', message: 'User already registered today' });
      }
      // Append new row (no Day Type column)
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
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: 'Sheet1',
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [newRow] }
      });
      return res.status(200).json({ status: 'success', message: 'Registration successful' });
    }

    // --- Check-in ---
    if (action === 'check-in') {
      if (userRowIdx === -1) {
        return res.status(400).json({ status: 'error', message: 'User not registered for today' });
      }
      const row = rows[userRowIdx];
      if (row[checkInIdx]) {
        return res.status(400).json({ status: 'error', message: 'Already checked in' });
      }
      // Update check-in time and location
      const checkInTime = getNowTime();
      const checkInLocation = location ? `${location.latitude},${location.longitude}` : '';
      const updateRange = `Sheet1!${String.fromCharCode(65 + checkInIdx)}${userRowIdx + 1}:${String.fromCharCode(65 + checkInLocIdx)}${userRowIdx + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[checkInTime, checkInLocation]] }
      });
      return res.status(200).json({ status: 'success', time: checkInTime });
    }

    // --- Check-out ---
    if (action === 'check-out') {
      if (userRowIdx === -1) {
        return res.status(400).json({ status: 'error', message: 'User not registered for today' });
      }
      const row = rows[userRowIdx];
      if (!row[checkInIdx]) {
        return res.status(400).json({ status: 'error', message: 'Please check-in first' });
      }
      if (row[checkOutIdx]) {
        return res.status(400).json({ status: 'error', message: 'Already checked out' });
      }
      // Update check-out time and location
      const checkOutTime = getNowTime();
      const checkOutLocation = location ? `${location.latitude},${location.longitude}` : '';
      const updateRange = `Sheet1!${String.fromCharCode(65 + checkOutIdx)}${userRowIdx + 1}:${String.fromCharCode(65 + checkOutLocIdx)}${userRowIdx + 1}`;
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[checkOutTime, checkOutLocation]] }
      });
      return res.status(200).json({ status: 'success', time: checkOutTime });
    }

    // --- Status ---
    if (action === 'status') {
      if (userRowIdx === -1) {
        return res.status(200).json({ status: 'not_checked_in' });
      }
      const row = rows[userRowIdx];
      if (!row[checkInIdx]) {
        return res.status(200).json({ status: 'not_checked_in' });
      }
      if (row[checkInIdx] && !row[checkOutIdx]) {
        return res.status(200).json({ status: 'checked_in', check_in_time: row[checkInIdx] });
      }
      return res.status(200).json({ status: 'completed', check_in_time: row[checkInIdx], check_out_time: row[checkOutIdx] });
    }

    // --- Unknown action ---
    return res.status(400).json({ status: 'error', message: 'Unknown action' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: err.message });
  }
}
