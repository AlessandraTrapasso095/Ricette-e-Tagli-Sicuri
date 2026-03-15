import { signOutAction } from "@/app/actions/auth-actions";

import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  className?: string;
}

export function LogoutButton({ className }: LogoutButtonProps) {
  return (
    <form action={signOutAction}>
      <Button variant="ghost" type="submit" className={className}>
        Esci
      </Button>
    </form>
  );
}
