import { lazy, Suspense } from 'react'
import { HashRouter, Route, Routes, Navigate } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { A11yProvider } from './contexts/A11yContext'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { CallSheetHost } from './components/emergency/CallSheet'
import { LocationProvider } from './contexts/LocationContext'
import { EmergencyProvider } from './contexts/EmergencyContext'
import { LanguageProvider } from './i18n/LanguageContext'
import { AppLayout } from './layouts/AppLayout'
import { HospitalLayout } from './layouts/HospitalLayout'
import { AdminLayout } from './layouts/AdminLayout'
import { RequireRole } from './components/navigation/RequireRole'
import { ScrollToTop } from './components/navigation/ScrollToTop'
import { Spinner } from './components/ui/States'

const Landing = lazy(() => import('./pages/public/Landing'))
const Login = lazy(() => import('./pages/public/Login'))
const Signup = lazy(() => import('./pages/public/Signup'))
const ForgotPassword = lazy(() => import('./pages/public/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/public/ResetPassword'))
const Emergency = lazy(() => import('./pages/public/Emergency'))
const FirstAidGuide = lazy(() => import('./pages/public/FirstAidGuide'))
const FirstAidLibrary = lazy(() => import('./pages/public/FirstAidLibrary'))
const Triage = lazy(() => import('./pages/public/Triage'))
const FindCare = lazy(() => import('./pages/public/FindCare'))
const HospitalProfile = lazy(() => import('./pages/public/HospitalProfile'))
const Wellness = lazy(() => import('./pages/public/Wellness'))
const NotFound = lazy(() => import('./pages/public/NotFound'))
const Assistant = lazy(() => import('./pages/public/Assistant'))

const PatientHome = lazy(() => import('./pages/patient/Home'))
const MyBookings = lazy(() => import('./pages/patient/Bookings'))
const BookingPassPage = lazy(() => import('./pages/patient/BookingPassPage'))
const HealthVault = lazy(() => import('./pages/patient/HealthVault'))
const Notifications = lazy(() => import('./pages/patient/Notifications'))
const Profile = lazy(() => import('./pages/patient/Profile'))

const Onboarding = lazy(() => import('./pages/hospital/Onboarding'))
const Dashboard = lazy(() => import('./pages/hospital/Dashboard'))
const LiveStatus = lazy(() => import('./pages/hospital/LiveStatus'))
const Slots = lazy(() => import('./pages/hospital/Slots'))
const HospitalBookings = lazy(() => import('./pages/hospital/Bookings'))
const CheckIn = lazy(() => import('./pages/hospital/CheckIn'))
const ProfileEditor = lazy(() => import('./pages/hospital/ProfileEditor'))
const Announcements = lazy(() => import('./pages/hospital/Announcements'))
const Verification = lazy(() => import('./pages/hospital/Verification'))
const HospitalReviews = lazy(() => import('./pages/hospital/Reviews'))
const Plan = lazy(() => import('./pages/hospital/Plan'))
const Analytics = lazy(() => import('./pages/hospital/Analytics'))
const Automations = lazy(() => import('./pages/hospital/Automations'))
const QrPoster = lazy(() => import('./pages/hospital/QrPoster'))
const Scan = lazy(() => import('./pages/public/Scan'))
const PassCheck = lazy(() => import('./pages/public/PassCheck'))
const PaymentVerify = lazy(() => import('./pages/payments/PaymentVerify'))
const TestCheckout = lazy(() => import('./pages/payments/TestCheckout'))
const HospitalPayments = lazy(() => import('./pages/hospital/Payments'))
const HospitalTeam = lazy(() => import('./pages/hospital/Team'))
const VerifyEmail = lazy(() => import('./pages/public/VerifyEmail'))
const PhoneAccess = lazy(() => import('./pages/public/PhoneAccess'))

const AdminReview = lazy(() => import('./pages/admin/Review'))

function Loading() {
  return <div className="grid min-h-[50vh] place-items-center text-slate-500"><Spinner className="h-6 w-6" /></div>
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <HashRouter>
        <ScrollToTop />
        <LanguageProvider>
        <A11yProvider>
        <ToastProvider>
          <AuthProvider>
            <LocationProvider>
              <EmergencyProvider>
                <CallSheetHost />
                <Suspense fallback={<Loading />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/signup" element={<Signup />} />
                    <Route path="/forgot-password" element={<ForgotPassword />} />
                    <Route path="/reset-password/:token" element={<ResetPassword />} />
                    <Route path="/verify-email/:token" element={<VerifyEmail />} />
                    <Route path="/emergency" element={<Emergency />} />
                    <Route path="/emergency/:slug" element={<FirstAidGuide />} />
                    <Route path="/hospital/onboarding" element={<RequireRole roles={['hospital']}><Onboarding /></RequireRole>} />

                    <Route element={<AppLayout />}>
                      <Route path="/find" element={<FindCare />} />
                      <Route path="/hospitals/:id" element={<HospitalProfile />} />
                      <Route path="/first-aid" element={<FirstAidLibrary />} />
                      <Route path="/phone" element={<PhoneAccess />} />
                      <Route path="/first-aid/:slug" element={<FirstAidGuide embedded />} />
                      <Route path="/triage" element={<Triage />} />
                      <Route path="/wellness" element={<Wellness />} />
                      <Route path="/assistant" element={<Assistant />} />
                      <Route path="/scan" element={<Scan />} />
                      <Route path="/pass/:ref" element={<PassCheck />} />
                      <Route path="/payment/verify" element={<PaymentVerify />} />
                      <Route path="/pay/test/:reference" element={<TestCheckout />} />
                      <Route path="/app" element={<RequireRole roles={['patient']}><PatientHome /></RequireRole>} />
                      <Route path="/app/bookings" element={<RequireRole roles={['patient']}><MyBookings /></RequireRole>} />
                      <Route path="/app/bookings/:id" element={<RequireRole roles={['patient']}><BookingPassPage /></RequireRole>} />
                      <Route path="/app/health" element={<RequireRole roles={['patient']}><HealthVault /></RequireRole>} />
                      <Route path="/app/notifications" element={<RequireRole roles={['patient']}><Notifications /></RequireRole>} />
                      <Route path="/app/profile" element={<RequireRole roles={['patient']}><Profile /></RequireRole>} />
                    </Route>

                    <Route element={<RequireRole roles={['hospital']} needsHospital><HospitalLayout /></RequireRole>}>
                      <Route path="/hospital" element={<Dashboard />} />
                      <Route path="/hospital/status" element={<LiveStatus />} />
                      <Route path="/hospital/slots" element={<Slots />} />
                      <Route path="/hospital/bookings" element={<HospitalBookings />} />
                      <Route path="/hospital/check-in" element={<CheckIn />} />
                      <Route path="/hospital/profile" element={<ProfileEditor />} />
                      <Route path="/hospital/announcements" element={<Announcements />} />
                      <Route path="/hospital/verification" element={<Verification />} />
                      <Route path="/hospital/reviews" element={<HospitalReviews />} />
                      <Route path="/hospital/plan" element={<Plan />} />
                      <Route path="/hospital/payments" element={<HospitalPayments />} />
                      <Route path="/hospital/team" element={<HospitalTeam />} />
                      <Route path="/hospital/analytics" element={<Analytics />} />
                      <Route path="/hospital/automations" element={<Automations />} />
                      <Route path="/hospital/qr" element={<QrPoster />} />
                      <Route path="/hospital/notifications" element={<Notifications />} />
                    </Route>

                    <Route element={<RequireRole roles={['admin']}><AdminLayout /></RequireRole>}>
                      <Route path="/admin" element={<AdminReview />} />
                    </Route>
                    <Route path="/home" element={<Navigate to="/" replace />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </EmergencyProvider>
            </LocationProvider>
          </AuthProvider>
        </ToastProvider>
        </A11yProvider>
        </LanguageProvider>
      </HashRouter>
    </MotionConfig>
  )
}
