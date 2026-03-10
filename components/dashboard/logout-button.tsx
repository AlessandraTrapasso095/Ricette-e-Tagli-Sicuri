import { signOutAction } from "@/app/actions/auth-actions";

import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <form action={signOutAction}>
      <Button variant="ghost" type="submit">
        Esci
      </Button>
    </form>
  );
}
