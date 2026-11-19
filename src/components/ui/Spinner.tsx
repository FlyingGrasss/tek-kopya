const sizes = {
  sm: "h-3.5 w-3.5 border-[1.5px]",
  md: "h-4 w-4 border-2",
};

export function Spinner({
  label = "Yükleniyor",
  size = "sm",
}: {
  label?: string;
  size?: keyof typeof sizes;
}) {
  return (
    <span className="inline-flex items-center" role="status">
      <span
        aria-hidden="true"
        className={`${sizes[size]} animate-spin rounded-full border-current border-r-transparent opacity-80`}
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
