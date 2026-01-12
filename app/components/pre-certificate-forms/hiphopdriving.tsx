// This form is displayed at the end of Hip Hop Driving course before claiming a certificate.

import { ValidatedForm } from "@rvf/react-router";
import { z } from "zod/v4";

import { FormField, FormSelect } from "~/components/ui/form";
import { SubmitButton } from "~/components/ui/submit-button";
import { useUser } from "~/hooks/useUser";

export const hipHopDrivingCertificationSchema = z
  .object({
    firstName: z.string().min(1, "Please enter your first name.").max(50, "First name must be 50 characters or less."),
    lastName: z.string().min(1, "Please enter your last name.").max(50, "Last name must be 50 characters or less."),
    middleInitial: z
      .string()
      .min(1, "Please enter up to two characters for your middle initial.")
      .max(2, "Please enter up to two characters for your middle initial."),
    street: z
      .string()
      .min(1, "Please enter your street address.")
      .max(100, "Street address must be 100 characters or less."),
    city: z.string().min(1, "Please enter your city.").max(25, "City must be 25 characters or less."),
    state: z.string().min(1, "Please enter your state.").max(2, "State must be 2 characters or less."),
    zipCode: z.string().min(1, "Please enter your zip code.").max(10, "Zip code must be 10 digits or less."),
    driversLicenseNumber: z
      .string()
      .min(1, "Please enter your driver's license number.")
      .max(16, "Driver's license number must be 16 characters or less."),
    driversLicenseState: z
      .string()
      .min(1, "Please enter the state that issued your driver's license.")
      .max(2, "State must be 2 characters or less."),
    dateOfBirth: z
      .string()
      .min(1, "Please enter your date of birth.")
      .refine((date) => {
        // Simple regex to check MM/DD/YYYY format
        return /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/(19|20)\d\d$/.test(date);
      }, "Please enter a valid date of birth in MM/DD/YYYY format."),
    phoneNumber: z
      .string()
      .min(1, "Please enter your phone number.")
      .max(20, "Phone number must be less than 20 characters."),
    gender: z.enum(["M", "F"]),
    reasonCode: z.enum(["T", "I", "E"]),
    courtName: z.string().max(100, "Court name must be less than 100 characters.").optional(),
  })
  // courtName is required when reasonCode is Ticket Dismissal
  .refine(
    (data) => {
      if (data.reasonCode === "T") {
        return data.courtName && data.courtName.trim().length > 0;
      }
      return true;
    },
    {
      message: "Please enter the court name.",
    },
  );

export function HiphopDrivingPreCertificateForm() {
  const { firstName, lastName, phone } = useUser();

  return (
    <ValidatedForm
      id="hiphopdriving-pre-certificate-form"
      method="post"
      schema={hipHopDrivingCertificationSchema}
      defaultValues={{
        firstName,
        lastName,
        middleInitial: "",
        street: "",
        city: "",
        state: "",
        zipCode: "",
        driversLicenseNumber: "",
        driversLicenseState: "",
        dateOfBirth: "",
        phoneNumber: phone ?? "",
        gender: "" as "M",
        reasonCode: "" as "T",
        courtName: "",
      }}
    >
      {(form) => (
        <>
          <legend>
            The state of Texas requires some additional information before issuing your certificate. Please fill out the
            fields below.
          </legend>
          <div className="mt-4 grid max-w-lg grid-cols-2 gap-4">
            <FormField scope={form.scope("firstName")} label="First Name" required autoComplete="given-name" />
            <FormField
              scope={form.scope("middleInitial")}
              label="Middle Initial"
              placeholder="e.g. A"
              required
              autoComplete="additional-name"
            />
            <FormField scope={form.scope("lastName")} label="Last Name" required autoComplete="family-name" />
            <div className="col-span-2">
              <FormField
                scope={form.scope("street")}
                label="Street"
                placeholder="e.g. 123 Main St"
                required
                autoComplete="street-address"
              />
            </div>
            <div className="col-span-2">
              <FormField scope={form.scope("city")} label="City" placeholder="e.g. Austin" required />
            </div>
            <FormField scope={form.scope("state")} label="State" placeholder="e.g. TX" required />
            <FormField scope={form.scope("zipCode")} label="Zip Code" placeholder="e.g. 78701" required />
            <FormField
              scope={form.scope("driversLicenseNumber")}
              label="Driver's License Number"
              placeholder="e.g. 1234567890"
              required
            />
            <FormField
              scope={form.scope("driversLicenseState")}
              label="Driver's License State"
              placeholder="e.g. TX"
              required
            />
            <FormField
              scope={form.scope("dateOfBirth")}
              label="Date of Birth (MM/DD/YYYY)"
              placeholder="e.g. 01/01/2000"
              required
              autoComplete="bday"
            />
            <FormField
              scope={form.scope("phoneNumber")}
              label="Phone Number"
              placeholder="e.g. 555-123-4567"
              required
              autoComplete="tel"
            />
            <FormSelect
              scope={form.scope("gender")}
              label="Gender on Driver's License"
              placeholder="Select option"
              required
              options={[
                { value: "M", label: "Male" },
                { value: "F", label: "Female" },
              ]}
            />
            <FormSelect
              scope={form.scope("reasonCode")}
              label="Reason for taking course"
              placeholder="Select option"
              required
              options={[
                { value: "T", label: "Ticket Dismissal" },
                { value: "I", label: "Insurance" },
                { value: "E", label: "Education" },
              ]}
            />
            {form.field("reasonCode").value() === "T" ? (
              <FormField
                required
                scope={form.scope("courtName")}
                label="Court Name"
                placeholder="e.g. Tarrant County"
              />
            ) : null}
          </div>
          <div className="mt-4">
            <SubmitButton isSubmitting={form.formState.isSubmitting} className="sm:w-auto">
              Claim Certificate
            </SubmitButton>
          </div>
        </>
      )}
    </ValidatedForm>
  );
}
