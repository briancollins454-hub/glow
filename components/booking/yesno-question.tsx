/**
 * Yes/No consultation question (e.g. "Have you had this service done before?").
 */
export function YesNoQuestion({
  name,
  required,
}: {
  name: string;
  required: boolean;
}) {
  return (
    <select
      name={name}
      required={required}
      defaultValue=""
      className="input cursor-pointer"
    >
      <option value="" disabled>
        Choose…
      </option>
      <option value="Yes">Yes</option>
      <option value="No">No</option>
    </select>
  );
}
