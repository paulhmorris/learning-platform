import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { IconCurrencyDollar } from "@tabler/icons-react";
import React, { useId } from "react";
import { useField } from "remix-validated-form";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={`${id}-error`} className="ml-1 mt-1 text-xs font-medium text-destructive">
      {error}
    </p>
  );
}

function FieldDescription({ id, description }: { id: string; description?: string }) {
  if (!description) return null;
  return (
    <p id={`${id}-description`} className="mt-1 text-xs text-muted-foreground">
      {description}
    </p>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string;
  label: string;
  description?: string;
  isCurrency?: boolean;
  formId?: string;
  hideLabel?: boolean;
}
export function FormField({ isCurrency = false, hideLabel = false, name, label, formId, className, ...props }: FieldProps) {
  const fallbackId = useId();
  const { error, getInputProps } = useField(name, { formId });

  const id = props.id ?? fallbackId;

  return (
    <div className={cn("relative w-full")}>
      <Label htmlFor={id} className={cn(hideLabel ? "sr-only" : "mb-1.5", error && "text-destructive", props.disabled && "cursor-not-allowed opacity-50")}>
        <span>{label}</span>
        <span className={cn("ml-1 inline-block font-normal", props.required || error ? "text-destructive" : "text-muted-foreground/60", !props.required && "text-xs")}>{props.required ? "*" : "(optional)"}</span>
      </Label>
      <Input
        id={id}
        inputMode={isCurrency ? "decimal" : props.inputMode}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={`${id}-error`}
        className={cn(error && "border-destructive focus-visible:ring-destructive/50", isCurrency && "pl-7", className)}
        {...getInputProps()}
        onBlur={(e) => {
          if (isCurrency) {
            const value = parseFloat(e.currentTarget.value);
            if (isNaN(value)) {
              e.currentTarget.value = "";
            } else {
              e.currentTarget.value = value.toFixed(2);
            }
          }
          props.onBlur?.(e);
        }}
        {...props}
      />
      {isCurrency ? (
        <span className="pointer-events-none absolute left-2 top-9 text-muted-foreground">
          <IconCurrencyDollar className="h-4 w-4 text-muted-foreground" strokeWidth={2.5} />
        </span>
      ) : null}
      <FieldDescription id={id} description={props.description} />
      <FieldError id={id} error={error} />
    </div>
  );
}
interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  name: string;
  label: string;
  description?: string;
  formId?: string;
  hideLabel?: boolean;
}
export function FormTextarea({ hideLabel = false, name, label, formId, className, ...props }: FormTextareaProps) {
  const fallbackId = useId();
  const { error, getInputProps } = useField(name, { formId });

  const id = props.id ?? fallbackId;

  return (
    <div className={cn("relative w-full")}>
      <Label htmlFor={id} className={cn(hideLabel ? "sr-only" : "mb-1.5", error && "text-destructive", props.disabled && "cursor-not-allowed opacity-50")}>
        <span>{label}</span>
        <span className={cn("ml-1 inline-block font-normal", props.required ? "text-destructive" : "text-xs text-muted-foreground/60")}>{props.required ? "*" : "(optional)"}</span>
      </Label>
      <Textarea
        id={id}
        aria-invalid={error ? true : props["aria-invalid"]}
        aria-describedby={`${id}-error`}
        className={cn(error && "border-destructive focus-visible:ring-destructive/50", className)}
        {...getInputProps()}
        {...props}
      />
      <FieldDescription id={id} description={props.description} />
      <FieldError id={id} error={error} />
    </div>
  );
}

export interface FormSelectProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  name: string;
  label: string;
  placeholder: string;
  description?: string;
  required?: boolean;
  id?: string;
  options?: Array<{ value: string | number | null; label: string | JSX.Element | null }>;
  hideLabel?: boolean;
  divProps?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
}

export function FormSelect(props: FormSelectProps) {
  const { name, label, placeholder, options, hideLabel, divProps, ...rest } = props;
  const { error, getInputProps } = useField(name);
  const { onChange, ...field } = getInputProps({});
  const fallbackId = useId();
  const id = props.id ?? fallbackId;

  return (
    <div {...divProps} className={cn("relative w-full", divProps?.className)}>
      <Label htmlFor={id} className={cn(hideLabel ? "sr-only" : "mb-1", error && "text-destructive", props.disabled && "cursor-not-allowed opacity-50")}>
        <span>{label}</span>
        <span className={cn("ml-1 inline-block font-normal", props.required ? "text-destructive" : "text-xs text-muted-foreground/60")}>{props.required ? "*" : "(optional)"}</span>
      </Label>
      <Select {...field} onValueChange={onChange}>
        <SelectTrigger id={id} {...rest} className={cn(error && "border-destructive focus-visible:ring-destructive/50", rest.className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options && options.length === 0 ? (
            // @ts-expect-error see https://github.com/radix-ui/primitives/issues/1569#issuecomment-1567414323
            <SelectItem value={null} disabled>
              No options
            </SelectItem>
          ) : (
            !props.required && (
              // @ts-expect-error see https://github.com/radix-ui/primitives/issues/1569#issuecomment-1567414323
              <SelectItem value={null} className="text-muted-foreground/60 focus:text-muted-foreground/60">
                {placeholder}
              </SelectItem>
            )
          )}
          {options
            ? options.map((o) => {
                if (o.value === null || o.label === null) return null;

                return (
                  <SelectItem key={o.value} value={o.value.toString()}>
                    {o.label}
                  </SelectItem>
                );
              })
            : props.children}
        </SelectContent>
        <FieldDescription id={id} description={props.description} />
        <FieldError id={id} error={error} />
      </Select>
    </div>
  );
}

export const Checkbox = React.forwardRef<React.ElementRef<typeof CheckboxPrimitive.Root>, React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer h-4 w-4 shrink-0 rounded-sm border border-muted-foreground/50 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className={cn("flex items-center justify-center text-current")}>
      <svg viewBox="0 0 16 16" stroke="currentColor" fill="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
        <path d="M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z" />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
