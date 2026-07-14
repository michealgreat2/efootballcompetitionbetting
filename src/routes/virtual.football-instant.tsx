import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Crosshair, Trophy, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { TeamLogo } from "@/components/TeamLogo";

// Per-user instant football shootout. Draws two random football-tagged teams,
// user picks a side + stake, and hitting "Place bet & shoot" starts the
// private shootout for that user only — no global countdown, no shared round.

type FbTeam = { id: string; name: string; logo_url: string | null };
type KickResult = { home_kicks: boolean[]; away_kicks: boolean[]; home_score: number; away_score: number; result: "won"|"lost"; payout: number };

export const Route = createFileRoute("/virtual/football-instant")({
  head: () => ({
    meta: [
      { title: "Instant E-Football — Per-User Shootouts" },
      { name: "description", content: "One-tap virtual football shootouts. Bet, shoot, settle — all private to you." },
    ],
  }),
  component: FootballInstantPage,
  errorComponent: ({ error }) => <Layout><div className="container py-12 text-center text-destructive">{error.message}</div></Layout>,
  notFoundComponent: () => <Layout><div className="container py-12 text-center text-muted-foreground">Not found.</div></Layout>,
});

function FootballInstantPage() {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(true);
  const [teams, setTeams] = useState<FbTeam[]>([]);
  const [pair, setPair] = useState<[FbTeam, FbTeam] | null>(null);
  const [side, setSide] = useState<"home"|"away">("home");
  const [stake, setStake] = useState(100);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<KickResult | null>(null);
  const [kickIdx, setKickIdx] = useState(-1);

  useEffect(() => {
    (async () => {
      const sb = supabase as any;
      const [{ data: s }, { data: t }] = await Promise.all([
        sb.from("app_settings").select("virtual_football_instant_enabled").eq("id",1).maybeSingle(),
        sb.from("teams").select("id,name,logo_url").eq("sport","football").order("name"),
      ]);
      setEnabled(!!s?.virtual_football_instant_enabled);
      setTeams((t ?? []) as FbTeam[]);
    })();
  }, []);

  useEffect(() => {
    if (teams.length >= 2 && !pair) drawPair();
  }, [teams, pair]);

  function drawPair() {
    if (teams.length < 2) return;
    const shuffled = [...teams].sort(() => Math.random() - 0.5);
    setPair([shuffled[0], shuffled[1]]);
    setResult(null); setKickIdx(-1);
  }

  async function placeBet() {
    if (!user) return toast.error("Sign in to play");
    if (!pair) return;
    if (stake <= 0) return toast.error("Stake must be positive");
    setBusy(true); setResult(null); setKickIdx(-1);
    const { data, error } = await (supabase as any).rpc("start_user_virtual_round", {
      p_home: pair[0].name, p_away: pair[1].name, p_side: side, p_stake: stake,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    const r = data as KickResult;
    setResult(r);
    let i = 0;
    const total = Math.max(r.home_kicks.length, r.away_kicks.length);
    const timer = setInterval(() => {
      setKickIdx(i); i++;
      if (i >= total) {
        clearInterval(timer);
        setTimeout(() => {
          if (r.result === "won") toast.success(`Won ${r.payout.toLocaleString()} LSL`);
          else toast.error("Better luck next round");
        }, 400);
      }
    }, 700);
  }

  return (
    <Layout>
      <PageShell tone="default">
        <div className="container py-6 space-y-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <Link to="/virtual"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1"/>Back</Button></Link>
            <Badge variant="outline" className="border-emerald-500/50 bg-emerald-500/10 text-emerald-300 uppercase tracking-widest text-[10px]">
              <Trophy className="h-3 w-3 mr-1"/> E-Football
            </Badge>
            <div className="w-12"/>
          </div>

          <header className="text-center">
            <h1 className="font-display text-3xl sm:text-4xl font-black gradient-gold-text leading-tight">Instant E-Football</h1>
            <p className="text-muted-foreground text-sm mt-1">Your private shootout starts the moment you place your bet.</p>
          </header>

          {!enabled ? (
            <Card className="glass p-10 text-center text-muted-foreground border-primary/30">Instant E-Football is currently closed.</Card>
          ) : teams.length < 2 ? (
            <Card className="glass p-10 text-center text-muted-foreground border-primary/30">
              Not enough football-tagged teams yet. Admins can tag teams as football from Clans admin.
            </Card>
          ) : !pair ? (
            <Card className="glass p-10 text-center"><Loader2 className="h-6 w-6 mx-auto animate-spin"/></Card>
          ) : (
            <Card className="glass p-5 border-primary/30 space-y-4">
              <div className="grid grid-cols-3 items-center gap-2">
                <button onClick={() => setSide("home")} className={`p-3 rounded-lg border transition ${side==="home"?"border-primary bg-primary/10":"border-border"}`}>
                  <TeamLogo name={pair[0].name} url={pair[0].logo_url} size={48} rounded="full" />
                  <div className="font-bold text-sm mt-1 truncate">{pair[0].name}</div>
                  <div className="text-[10px] text-muted-foreground">Home · 1.90x</div>
                </button>
                <div className="text-center font-black text-2xl gradient-gold-text">
                  {result ? `${result.home_score} : ${result.away_score}` : "VS"}
                </div>
                <button onClick={() => setSide("away")} className={`p-3 rounded-lg border transition ${side==="away"?"border-primary bg-primary/10":"border-border"}`}>
                  <TeamLogo name={pair[1].name} url={pair[1].logo_url} size={48} rounded="full" />
                  <div className="font-bold text-sm mt-1 truncate">{pair[1].name}</div>
                  <div className="text-[10px] text-muted-foreground">Away · 1.90x</div>
                </button>
              </div>

              {result && (
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">{pair[0].name}</div>
                    <div className="flex gap-1">{result.home_kicks.map((k,i) => (
                      <span key={i} className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ${i>kickIdx?"bg-muted/30 text-muted-foreground":k?"bg-emerald-500/30 text-emerald-300":"bg-red-500/30 text-red-300"}`}>{i>kickIdx?"·":k?"✓":"✗"}</span>
                    ))}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground">{pair[1].name}</div>
                    <div className="flex gap-1">{result.away_kicks.map((k,i) => (
                      <span key={i} className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold ${i>kickIdx?"bg-muted/30 text-muted-foreground":k?"bg-emerald-500/30 text-emerald-300":"bg-red-500/30 text-red-300"}`}>{i>kickIdx?"·":k?"✓":"✗"}</span>
                    ))}</div>
                  </div>
                </div>
              )}

              {!result && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Stake (LSL)</Label>
                    <Input type="number" value={stake} min={1} onChange={(e) => setStake(Number(e.target.value)||0)} />
                  </div>
                  <div className="flex items-end">
                    <Button className="btn-luxury w-full" onClick={placeBet} disabled={busy || !user}>
                      {busy ? <Loader2 className="h-4 w-4 animate-spin mr-1"/> : <Crosshair className="h-4 w-4 mr-1"/>}
                      Place bet & shoot
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-center pt-2">
                <Button variant="ghost" size="sm" onClick={drawPair}>Draw new matchup</Button>
              </div>
            </Card>
          )}
        </div>
      </PageShell>
    </Layout>
  );
}