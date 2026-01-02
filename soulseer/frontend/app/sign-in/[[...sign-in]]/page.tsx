import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-alex-brush text-6xl text-mystical-pink mb-4">
            SoulSeer
          </h1>
          <p className="text-gray-300 font-playfair">
            Sign in to connect with gifted psychics
          </p>
        </div>
        <SignIn 
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "mystical-card",
              headerTitle: "text-mystical-pink font-playfair",
              headerSubtitle: "text-gray-300",
              socialButtonsBlockButton: "border-mystical-pink/30 hover:border-mystical-pink",
              formButtonPrimary: "bg-mystical-pink hover:bg-mystical-darkPink",
              footerActionLink: "text-mystical-pink hover:text-mystical-darkPink",
            }
          }}
          routing="path"
          path="/sign-in"
          signUpUrl="/sign-up"
          afterSignInUrl="/dashboard"
        />
      </div>
    </div>
  )
}