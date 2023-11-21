import { FormConfig, useForm as useConform } from "@conform-to/react";
import { getFieldsetConstraint, parse } from "@conform-to/zod";
import { useId } from "react";
import { z } from "zod";

import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

export type ListOfErrors = Array<string | null | undefined> | null | undefined;

export function ErrorList({ id, errors }: { errors?: ListOfErrors; id?: string }) {
  const errorsToRender = errors?.filter(Boolean);
  if (!errorsToRender?.length) return null;
  return (
    <ul id={id} className="flex flex-col gap-1">
      {errorsToRender.map((e) => (
        <li key={e} className="text-xs font-semibold text-destructive">
          {e}
        </li>
      ))}
    </ul>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  errors?: ListOfErrors;
}
export function Field(props: FieldProps) {
  const fallbackId = useId();
  const id = props.id ?? fallbackId;
  const { errors, label, ...rest } = props;
  const errorId = errors?.length ? `${id}-error` : undefined;
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} aria-invalid={errorId ? true : undefined} aria-describedby={errorId} {...rest} />
      <div className="mt-1 min-h-[18px] pl-1">{errorId ? <ErrorList id={errorId} errors={errors} /> : null}</div>
    </div>
  );
}

export function useForm<S extends z.ZodTypeAny>({ schema, ...config }: { schema: S } & FormConfig<z.infer<S>>) {
  return useConform<z.infer<S>>({
    shouldRevalidate: "onBlur",
    constraint: getFieldsetConstraint(schema),
    onValidate({ formData }) {
      return parse(formData, { schema });
    },
    ...config,
  });
}
