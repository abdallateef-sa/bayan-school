# Bayan School Enrollment System

A modern, multi-step enrollment form for Arabic & Quran studies with a beautiful UI and backend-ready architecture.

## Features

- **Multi-step Form**: Personal info, package selection, scheduling, and confirmation
- **Real-time Validation**: Form validation with user-friendly error messages
- **Calendar Integration**: Interactive calendar with time slot selection
- **Package Management**: Multiple learning packages with pricing
- **Timezone Support**: Automatic timezone detection and display
- **Backend Ready**: API routes and data structures prepared for backend integration
- **Responsive Design**: Works seamlessly on desktop and mobile devices

## Getting Started

1. **Install dependencies:**
   \`\`\`bash
   npm install
   \`\`\`

2. **Run the development server:**
   \`\`\`bash
   npm run dev
   \`\`\`

3. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Backend Integration

The project is structured for easy backend integration:

### API Routes
- `POST /api/enrollment` - Submit enrollment data
- `POST /api/enrollment/confirm` - Send confirmation email
- `GET /api/enrollment/slots?date=YYYY-MM-DD` - Get available time slots

### Data Types
All TypeScript interfaces are defined in `/types/enrollment.ts` for consistent data handling.

### Database Integration
To add database functionality:

1. **Choose your database** (PostgreSQL, MySQL, MongoDB, etc.)
2. **Add connection string** to environment variables
3. **Implement database operations** in the API routes
4. **Add data validation** and error handling

### Email Integration
To add email functionality:

1. **Choose email service** (Resend, SendGrid, Nodemailer, etc.)
2. **Add API keys** to environment variables
3. **Implement email templates** for confirmations
4. **Update the confirmation API route**

### Authentication (Optional)
For admin features or user accounts:

1. **Add NextAuth.js** or similar authentication
2. **Create admin dashboard** for managing enrollments
3. **Add user profiles** for tracking progress

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

\`\`\`env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
# Add database and email service keys as needed
\`\`\`

## Project Structure

\`\`\`
├── app/
│   ├── api/enrollment/          # API routes for backend
│   ├── layout.tsx               # Root layout
│   └── page.tsx                 # Main page
├── components/
│   ├── bayan-enrollment-form.tsx    # Original form component
│   └── enhanced-enrollment-form.tsx # Enhanced form with API integration
├── lib/
│   └── enrollment-api.ts        # API client functions
├── types/
│   └── enrollment.ts            # TypeScript interfaces
└── README.md
\`\`\`

## Customization

- **Styling**: Modify Tailwind classes in components
- **Packages**: Update package data in the form component
- **Countries**: Modify the countries list as needed
- **Time Slots**: Adjust available hours in the API route
- **Validation**: Add custom validation rules in form handlers

## Deployment

The project is ready for deployment on Vercel, Netlify, or any Next.js-compatible platform.

1. **Build the project:**
   \`\`\`bash
   npm run build
   \`\`\`

2. **Deploy to your platform** of choice

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - feel free to use this project for your educational institution.
