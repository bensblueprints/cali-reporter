import './globals.css';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';

const SITE_URL = process.env.SITE_URL || 'https://calireporter.com';

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Cali Reporter — National, California, and West Coast business news',
    template: '%s · Cali Reporter',
  },
  description:
    'A magazine-style daily on U.S. national headlines, California politics and culture, and West Coast business. Updated three times a day.',
  openGraph: {
    type: 'website',
    siteName: 'Cali Reporter',
    locale: 'en_US',
  },
  alternates: {
    types: { 'application/rss+xml': '/rss.xml' },
    canonical: '/',
  },
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700;900&family=Source+Serif+4:wght@400;600&display=swap"
        />
      </head>
      <body className="font-sans">
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
