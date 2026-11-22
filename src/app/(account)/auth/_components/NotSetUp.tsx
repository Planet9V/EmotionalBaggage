import { Frame, TextLink } from "./Frame";

/** Shown instead of sign-up, reset and invitations while the install has no owner yet (review B3). */
export function NotSetUp() {
  return (
    <Frame title="Not set up yet" footer={<p><TextLink href="/auth/first-run">Go to the first-run page</TextLink></p>}>
      <p className="text-sm text-primary">This installation is not set up yet: its owner has to be created first, on the first-run page. Accounts can be created once that is done.</p>
    </Frame>
  );
}
