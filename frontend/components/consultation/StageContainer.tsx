"use client";

interface StageContainerProps {
  children: React.ReactNode;
  width?: "narrow" | "wide";
}

export default function StageContainer({ children, width = "narrow" }: StageContainerProps) {
  const max = width === "wide" ? "max-w-7xl" : "max-w-2xl";
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8">
      <div className={`mx-auto w-full ${max}`}>{children}</div>
    </div>
  );
}
