export default function Hash({
  value,
  chars = 6,
}: {
  value: string;
  chars?: number;
}) {
  const short =
    value.length > 12
      ? `${value.slice(0, chars + 2)}…${value.slice(-chars)}`
      : value;
  return (
    <span className="hash" title={value}>
      {short}
    </span>
  );
}
