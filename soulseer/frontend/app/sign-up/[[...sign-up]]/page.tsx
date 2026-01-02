import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-alex-brush text-6xl text-mystical-pink mb-4">
            SoulSeer
          </h1>
          <p className="text-gray-300 font-playfair">
            Join our community of spiritual seekers
          </p>
        </div>
        <SignUp 
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
          path="/sign-up"
          signInUrl="/sign-in"
          afterSignUpUrl="/dashboard"
        />
      </div>
    </div>
  )
}