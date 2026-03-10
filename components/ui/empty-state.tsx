import { Card, CardDescription, CardTitle } from "@/components/ui/card";

interface EmptyStateProps {
  title: string;
  description: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
    </Card>
  );
}
