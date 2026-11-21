"use client";

// What Admin, Credentials shows under the Amazon, X and Instagram cards: the setup the service needs,
// "Connect X account" (OAuth 2.0 with PKCE), and the Meta App Review checklist.
import { useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorLine, LoadError, LoadingBlocks } from "@/components/ui/states";
import { channelQueries, useChannelActions } from "@/lib/channels/client";
import { messageOf } from "@/lib/queries";

const NOT_REAL = "Built to the service's documentation and tested against a stand-in only. It has not yet been run against the real service: the Test button is how you confirm it once your account exists.";

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-link hover:underline">
    {children} <ExternalLink className="inline h-3 w-3" aria-hidden />
  </a>
);

function AmazonNotes() {
  return (
    <div className="space-y-1 text-xs text-secondary">
      <p>
        Needs a <strong className="font-medium text-primary">Professional</strong> selling account (Amazon: &quot;you must have a professional selling account to develop SP-API&quot; applications;{" "}
        <A href="https://developer-docs.amazon.com/sp-api/docs/sp-api-registration-overview">registration overview</A>). Register as a private developer in Seller Central, Apps and Services, Develop Apps, with the{" "}
        <strong className="font-medium text-primary">Inventory and Order Tracking</strong> role, then self-authorize the app to get the refresh token.
      </p>
      <p>The access token is fetched when needed and kept only in this server&apos;s memory. Calls obey Amazon&apos;s documented rates (searchOrders 0.0056 a second, burst 20; order metrics 0.5 a second, burst 15) and back off on HTTP 429.</p>
      <p className="text-muted">{NOT_REAL}</p>
    </div>
  );
}

function XNotes() {
  const params = useSearchParams();
  const outcome = params.get("x");
  const { connectX } = useChannelActions("");
  const [error, setError] = useState("");
  const origin = useSyncExternalStore(
    () => () => undefined,
    () => window.location.origin,
    () => ""
  );
  const MESSAGES: Record<string, [boolean, string]> = {
    connected: [true, "X account connected. The tokens are saved above; press Test connection to check."],
    refused: [false, "X said the sign-in was cancelled or refused. Nothing was saved."],
    state: [false, "The answer from X did not match a sign-in started from this page (or it expired). Nothing was saved; start again."],
    failed: [false, "X sent the browser back, but the code could not be exchanged for tokens. Check the client ID, the secret and the callback address, then start again."],
  };
  const said = outcome ? MESSAGES[outcome] : undefined;
  return (
    <div id="x" className="space-y-2 text-xs text-secondary">
      <p>
        In the <A href="https://console.x.com">X Developer Console</A>, switch on OAuth 2.0 for your app, choose Web App (a confidential client with a secret) or Native App, and add this callback address exactly:{" "}
        <span className="font-mono text-primary wrap-anywhere">{origin ? `${origin}/api/channels/x/callback` : "(this app's address)/api/channels/x/callback"}</span>. Save the client ID (and secret) above, then connect.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={connectX.isPending}
          onClick={() => {
            setError("");
            connectX.mutate(undefined, { onSuccess: (r) => window.location.assign(r.url), onError: (e) => setError(messageOf(e)) });
          }}
        >
          {connectX.isPending ? "Opening X" : "Connect X account"}
        </Button>
        <span className="text-muted">Asks X for: post, read posts and your account, upload images, stay connected.</span>
      </div>
      {said ? <p role={said[0] ? "status" : "alert"} className={said[0] ? "text-success" : "text-danger"}>{said[1]}</p> : null}
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      <p>
        X charges per call (pay-per-usage, read 21 Nov 2026 from <A href="https://docs.x.com/x-api/getting-started/pricing">X&apos;s pricing page</A>): the Test button reads your account, billed as a user read. The full statement is on Marketing, Posting and must be acknowledged before the first send.
      </p>
      <p className="text-muted">{NOT_REAL}</p>
    </div>
  );
}

function InstagramChecklist() {
  const review = useQuery(channelQueries.review());
  const { saveTicks } = useChannelActions("");
  const [error, setError] = useState("");
  return (
    <div className="space-y-2 text-xs text-secondary">
      <p className="font-medium text-primary">Meta App Review checklist</p>
      <p>Meta&apos;s review can take weeks, so start it as soon as an account exists. Ticks are saved for this install.</p>
      {review.isPending ? (
        <LoadingBlocks rows={1} label="Reading the checklist" />
      ) : review.isError ? (
        <LoadError what="The checklist" message={messageOf(review.error)} onRetry={() => void review.refetch()} />
      ) : (
        <ul className="space-y-2">
          {review.data.items.map((it) => {
            const id = `ig-check-${it.key}`;
            return (
              <li key={it.key} className="rounded-md border border-hairline p-2">
                <label htmlFor={id} className="flex items-start gap-2 text-sm text-primary">
                  <input
                    id={id}
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-[var(--color-dutchOrange)]"
                    checked={!!review.data.ticks[it.key]}
                    disabled={saveTicks.isPending}
                    onChange={(e) => {
                      setError("");
                      saveTicks.mutate({ [it.key]: e.target.checked }, { onError: (x) => setError(messageOf(x)) });
                    }}
                  />
                  {it.text}
                </label>
                <p className="mt-1 pl-6">{it.detail}</p>
                <p className="mt-1 flex flex-wrap gap-3 pl-6">{it.links.map((l) => <A key={l.url + l.label} href={l.url}>{l.label}</A>)}</p>
              </li>
            );
          })}
        </ul>
      )}
      {error ? <ErrorLine>{error}</ErrorLine> : null}
      <p className="text-muted">{NOT_REAL}</p>
    </div>
  );
}

/** Extra content for a provider card; nothing for providers that are not channels. */
export function ChannelProviderNotes({ id }: { id: string }) {
  if (id === "amazon-sp") return <AmazonNotes />;
  if (id === "x") return <XNotes />;
  if (id === "instagram") return <InstagramChecklist />;
  return null;
}
