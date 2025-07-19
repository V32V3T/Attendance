# Smart QR Attendance System

A web-based QR code attendance tracking system that allows users to register, check in, and check out using QR code scanning. The application stores attendance data in Google Sheets.

## Features

- User registration with personal details
- Auto-generated sequential Employee IDs (6-digit format: 000001, 000002, etc.)
- QR code scanning for attendance
- Manual check-in and check-out options
- Upload QR code images from gallery
- Real-time attendance status updates
- Location tracking (optional)
- Mobile-responsive design
- Timezone-aware timestamps (configured for IST - Indian Standard Time)

## Setup Instructions

### Prerequisites

- Node.js installed
- Vercel account for deployment
- Google Cloud Platform account with Sheets API enabled
- Google Service Account with access to Google Sheets

### Environment Variables

The following environment variables need to be set in your Vercel project:

- `GOOGLE_SERVICE_ACCOUNT`: JSON string of your Google service account credentials
- `GOOGLE_SHEET_ID`: ID of the Google Sheet where attendance data will be stored

### Timezone Configuration

The application is configured to use **Indian Standard Time (IST)** by default. All timestamps for check-in and check-out are recorded in IST regardless of where the Vercel server is hosted.

To change the timezone, modify the `TIMEZONE` constant in `/api/log-attendance.js`:
```javascript
const TIMEZONE = 'Asia/Kolkata'; // Change this to your desired timezone
```

Common timezone values:
- `'Asia/Kolkata'` - Indian Standard Time (IST)
- `'America/New_York'` - Eastern Time
- `'Europe/London'` - Greenwich Mean Time
- `'Asia/Tokyo'` - Japan Standard Time

### Google Sheet Structure

The application expects a Google Sheet with the following columns:
- Full Name
- Mobile
- Employee ID
- Department
- Date
- Check-in Time
- Check-in Location
- Check-out Time
- Check-out Location

If the sheet doesn't exist with these headers, the application will create them automatically.

### Deployment

1. Clone this repository
2. Install dependencies: `npm install`
3. Deploy to Vercel: `vercel`

## Usage

1. Open the application in a web browser
2. Fill in your personal information (Name, Mobile, Department) and register
3. Your Employee ID will be automatically generated (e.g., 000001, 000002, etc.)
4. Scan the QR code to check in
5. Scan the QR code again to check out when leaving

## Employee ID System

The application automatically generates sequential 6-digit Employee IDs:
- First user: `000001`
- Second user: `000002`
- And so on...

The system prevents duplicate registrations by checking mobile numbers. If a user tries to register with an existing mobile number, they will be shown their existing Employee ID.

## QR Code

The application is configured to recognize a specific QR code value. The default value is:
```
f29cZb7Q6DuaMjYkTLV3nxR9KEqV2XoBslrHcwA8d1tZ5UeqgiWTvjNpLEsQ
```

You can generate a QR code with this value using any QR code generator.

## Troubleshooting

If you encounter issues with the application:

1. Check the browser console for error messages
2. Verify that your environment variables are correctly set
3. Ensure your Google service account has proper permissions
4. Check that your Google Sheet has the correct structure

## License

This project is licensed under the MIT License.