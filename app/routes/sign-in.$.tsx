import { SignIn } from "@clerk/react-router";

export default function SignInPage() {
  return (
    <>
      <title>Sign In | Plumb Media & Education</title>
      <div className="flex min-h-dvh w-dvw items-start justify-center pt-[clamp(2rem,10vw,5rem)]">
        <SignIn />
      </div>
    </>
  );
}
