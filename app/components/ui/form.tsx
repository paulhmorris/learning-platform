import { FormScope, useField, ValueOfInputType } from "@rvf/react-router";
import { IconCurrencyDollar, IconEye, IconEyeOff } from "@tabler/icons-react";
import { ComponentPropsWithRef, forwardRef, JSX, useId, useState } from "react";

import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "~/components/ui/select";
import { Textarea } from "~/components/ui/textarea";
import { cn } from "~/lib/utils";

export function GenericFieldError({ error }: { error?: string | null }) {
  if (!error) return null;
  return (
    <p aria-live="polite" role="alert" className="ml-1 mt-1 text-xs font-medium text-destructive">
      {error ? <span>{error}</span> : null}
    </p>
  );
}

function FieldError({ id, error }: { id: string; error?: string | null }) {
  if (!error) return null;
  return (
    <p aria-live="polite" role="alert" id={`${id}-error`} className="ml-1 mt-1 text-xs font-medium text-destructive">
      {error ? <span>{error}</span> : null}
    </p>
  );
}

function FieldDescription({ id, description }: { id: string; description?: string }) {
  if (!description) return null;
  return (
    <p id={`${id}-description`} className="ml-1 mt-1 text-xs text-muted-foreground">
      {description}
    </p>
  );
}

function LabelOptionalIndicator({ required, error }: { required?: boolean; error: string | null }) {
  return (
    <span className={cn(required || error ? "text-destructive" : "text-muted-foreground", !required && "text-xs")}>
      {required ? "*" : "(optional)"}
    </span>
  );
}

type BaseFieldProps = Omit<ComponentPropsWithRef<"input">, "type">;
interface FieldProps<Type extends string> extends BaseFieldProps {
  scope: FormScope<ValueOfInputType<Type> | null | undefined>;
  label: string;
  type?: Type;
  description?: string;
  isCurrency?: boolean;
  hideLabel?: boolean;
}

export const FormField = forwardRef<HTMLInputElement, FieldProps<string>>(
  ({ scope, label, className, description, hideLabel = false, isCurrency = false, type: _type, ...props }, ref) => {
    const fallbackId = useId();
    const field = useField(scope);
    const [type, setType] = useState(_type);

    const inputId = props.id ?? fallbackId;
    const error = field.error();

    return (
      <div className={cn("relative w-full")}>
        <div
          className={cn(
            "flex items-center gap-x-1 leading-4",
            error && "text-destructive",
            props.disabled && "cursor-not-allowed opacity-50",
            hideLabel && "sr-only",
          )}
        >
          <Label htmlFor={inputId}>{label}</Label>
          <LabelOptionalIndicator required={props.required} error={error} />
        </div>
        <div className="relative mt-0.5">
          <Input
            {...field.getInputProps({
              ref,
              type,
              id: inputId,
              inputMode: isCurrency ? "decimal" : props.inputMode,
              "aria-invalid": error ? true : props["aria-invalid"],
              "aria-errormessage": error ? `${inputId}-error` : props["aria-errormessage"],
              "aria-describedby": description ? `${inputId}-description` : props["aria-describedby"],
              className: cn(isCurrency && "pl-7", _type === "password" && "pr-10", className),
              onBlur: (e) => {
                if (isCurrency) {
                  const value = parseFloat(e.currentTarget.value);
                  if (isNaN(value)) {
                    e.currentTarget.value = "";
                  } else {
                    e.currentTarget.value = value.toFixed(2);
                  }
                }
                props.onBlur?.(e);
              },
              ...props,
            })}
          />
          {isCurrency ? (
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2">
              <IconCurrencyDollar className="size-4" strokeWidth={2.5} />
            </span>
          ) : null}
          {_type === "password" ? (
            <button
              type="button"
              className="focus:outline-hidden focus-visible:ring-3 absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-2 text-xs transition hover:underline focus-visible:ring-primary/50"
              onClick={() => setType((t) => (t === "password" ? "text" : "password"))}
            >
              {type === "password" ? (
                <IconEyeOff className="size-5.5" aria-hidden="true" />
              ) : (
                <IconEye className="size-5.5" aria-hidden="true" />
              )}
              <span className="sr-only">{type === "password" ? "Show password" : "Hide password"}</span>
            </button>
          ) : null}
        </div>
        {error ? (
          <FieldError id={inputId} error={error} />
        ) : (
          <FieldDescription id={inputId} description={description} />
        )}
      </div>
    );
  },
);

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  scope: FormScope<string | null | undefined>;
  label: string;
  description?: string;
  hideLabel?: boolean;
}
export function FormTextarea({ hideLabel = false, scope, label, className, description, ...props }: FormTextareaProps) {
  const fallbackId = useId();
  const field = useField(scope);
  const error = field.error();
  const inputId = props.id ?? fallbackId;

  return (
    <div className={cn("relative w-full")}>
      <div
        className={cn(
          "flex items-center gap-x-1 leading-4",
          error && "text-destructive",
          props.disabled && "cursor-not-allowed opacity-50",
          hideLabel && "sr-only",
        )}
      >
        <Label htmlFor={inputId}>{label}</Label>
        <LabelOptionalIndicator required={props.required} error={error} />
      </div>
      <div className="mt-0.5">
        <Textarea
          {...field.getInputProps({
            id: inputId,
            "aria-invalid": error ? true : props["aria-invalid"],
            "aria-errormessage": error ? `${inputId}-error` : props["aria-errormessage"],
            "aria-describedby": description ? `${inputId}-description` : props["aria-describedby"],
            className: cn(className),
            ...props,
          })}
        />
      </div>
      {error ? <FieldError id={inputId} error={error} /> : <FieldDescription id={inputId} description={description} />}
    </div>
  );
}

export interface FormSelectProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  scope: FormScope<string | number | null | undefined>;
  label: string;
  placeholder: string;
  description?: string;
  required?: boolean;
  options?: Array<{ value: string | number | null; label: string | JSX.Element | null; disabled?: boolean }>;
  hideLabel?: boolean;
  divProps?: React.HTMLAttributes<HTMLDivElement>;
  children?: React.ReactNode;
}

export function FormSelect(props: FormSelectProps) {
  const { scope, label, placeholder, options, hideLabel, divProps, ...rest } = props;
  const field = useField(scope);
  const selectId = useId();
  const { onChange, name, ...input } = field.getControlProps();
  const error = field.error();

  return (
    <div {...divProps} className={cn("relative w-full", divProps?.className)}>
      <div
        className={cn(
          "flex items-center gap-x-1 leading-4",
          error && "text-destructive",
          props.disabled && "cursor-not-allowed opacity-50",
          hideLabel && "sr-only",
        )}
      >
        <Label htmlFor={selectId}>{label}</Label>
        <LabelOptionalIndicator required={props.required} error={error} />
      </div>
      <input type="hidden" name={name} value={input.value?.toString()} />
      <Select
        {...input}
        value={String(input.value)}
        onValueChange={(v) => {
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          if (v === undefined || v === "undefined") {
            onChange("");
          } else {
            onChange(v);
          }
        }}
      >
        <SelectTrigger
          id={selectId}
          {...rest}
          aria-label={placeholder}
          className={cn(
            "mt-0.5",
            error && "border-destructive ring-destructive/20 dark:ring-destructive/40",
            rest.className,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options && options.length === 0 ? (
            // @ts-expect-error see https://github.com/radix-ui/primitives/issues/1569#issuecomment-1567414323
            <SelectItem key={`${selectId}-no-options`} value={undefined} disabled>
              No options
            </SelectItem>
          ) : (
            !props.required && (
              <SelectItem
                key={`${selectId}-undefined-option`}
                // @ts-expect-error see https://github.com/radix-ui/primitives/issues/1569#issuecomment-1567414323
                value={undefined}
                className="text-muted-foreground/60 focus:text-muted-foreground/60"
              >
                {placeholder}
              </SelectItem>
            )
          )}
          {options
            ? options.map((o) => {
                if (o.value === null || o.label === null) return null;

                return (
                  <SelectItem
                    disabled={o.disabled}
                    key={`${selectId}-${o.value.toString()}`}
                    value={o.value.toString()}
                  >
                    {o.label}
                  </SelectItem>
                );
              })
            : props.children}
        </SelectContent>
        {error ? (
          <FieldError id={selectId} error={error} />
        ) : (
          <FieldDescription id={selectId} description={props.description} />
        )}
      </Select>
    </div>
  );
}

export function FormCheckbox({
  scope,
  label,
  description,
}: {
  scope: FormScope<boolean | string | null | undefined>;
  label: string;
  description?: string;
}) {
  const field = useField(scope);
  const inputId = useId();
  const error = field.error();

  const { value, onChange, ref } = field.getControlProps();

  return (
    <div>
      <Label className="inline-flex cursor-pointer items-center gap-2">
        <Checkbox ref={ref} checked={!!value} onCheckedChange={onChange} />
        <span>{label}</span>
      </Label>
      <FieldDescription id={inputId} description={description} />
      <FieldError id={inputId} error={error} />
    </div>
  );
}

export function UncontrolledCheckbox({
  label,
  description,
  ...rest
}: ComponentPropsWithRef<typeof Checkbox> & { label: string; description?: string }) {
  const inputId = useId();
  return (
    <div>
      <Label className="inline-flex cursor-pointer items-center gap-x-2">
        <Checkbox {...rest} />
        <span>{label}</span>
      </Label>
      <FieldDescription id={inputId} description={description} />
    </div>
  );
}
