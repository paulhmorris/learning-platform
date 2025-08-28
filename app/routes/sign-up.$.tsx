import { SignUp } from "@clerk/react-router";

export default function SignUpPage() {
  return (
    <>
      <title>Sign Up | Plumb Media & Education</title>
      <div className="flex min-h-dvh w-dvw items-start justify-center pt-[clamp(2rem,10vw,5rem)]">
        <SignUp />
      </div>
    </>
  );
}
