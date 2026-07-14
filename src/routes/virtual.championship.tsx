import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { PageShell } from "@/components/PageShell";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Trophy, Clock, Radio, Sparkles } from "lucide-react";

export const Route = createFileRoute("/virtual/championship")({
  head: () => ({
    meta: [
      { title: "Championship Virtual — 16-team Knockout | LSL" },
      { name: "description", content: "16-team virtual knockout tournament. Bet on champions, stage reachers, and per-match winners." },
    ],
  }),
  component: ChampionshipPage,
});

type Tournament = { id: string; name: string | null; starts_at: string | null; status: string | null; current_stage: string | null };

function ChampionshipPage() {
  const [enabled, setEnabled] = useState(true);
  const [active, setActive] = useState<Tournament | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const load = async () => {
      const sb = supabase as any;
      const { data: s } = await sb.from("app_settings").select("virtual_championship_enabled").eq("id", 1).maybeSingle();
      setEnabled(!!s?.virtual_championship_enabled);
      const { data: t } = await sb
        .from("tournaments")
        .select("id,name,starts_at,status,current_stage")
        .eq("kind", "championship_virtual")
        .in("status", ["scheduled", "live"])
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      setActive((t ?? null) as Tournament | null);
    };
    load();
    const t = setInterval(load, 10_000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(t); clearInterval(tick); };
  }, []);

  const startsAt = active?.starts_at ? new Date(active.starts_at).getTime() : null;
  const cd = startsAt ? Math.max(0, Math.floor((startsAt - now) / 1000)) : null;
  const mm = cd != null ? String(Math.floor(cd / 60)).padStart(2, "0") : "--";
  const ss = cd != null ? String(cd % 60).padStart(2, "0") : "--";

  return (
    <Layout>
      <PageShell tone="default">
        <div className="container py-6 sm:py-10 space-y-6 max-w-4xl">
          <div className="flex items-center justify-between">
            <Link to="/virtual"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
            <Badge variant="outline" className="border-amber-500/50 bg-amber-500/10 text-amber-300 uppercase tracking-widest text-[10px]">
              <Trophy className="h-3 w-3 mr-1" /> Championship Virtual
            </Badge>
            <div className="w-12" />
          </div>

          <header className="text-center max-w-2xl mx-auto">
            <h1 className="font-display text-3xl sm:text-5xl font-black gradient-gold-text leading-tight">
              16-Team Knockout
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">
              Round of 16 → Quarters → Semis → Final. Bracket revealed live between stages.
            </p>
          </header>

          {!enabled ? (
            <Card className="glass p-10 text-center text-muted-foreground border-primary/30">
              <Trophy className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-semibold">Championship Virtual is currently closed.</p>
              <p className="text-xs mt-1">The next tournament will be announced soon.</p>
            </Card>
          ) : !active ? (
            <Card className="glass p-10 text-center text-muted-foreground border-primary/30">
              <Sparkles className="h-10 w-10 mx-auto mb-3 text-primary/50" />
              <p className="font-semibold">No championship scheduled right now.</p>
              <p className="text-xs mt-1">Admins schedule new 16-team knockouts from the Championship panel.</p>
            </Card>
          ) : active.status === "scheduled" ? (
            <Card className="glass p-8 border-primary/30 text-center">
              <div className="text-[10px] uppercase tracking-[0.35em] text-amber-300 mb-2">Next tournament kicks off in</div>
              <div className="text-6xl sm:text-7xl font-black gradient-gold-text tabular-nums leading-none">
                {mm}:{ss}
              </div>
              <div className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1">
                <Clock className="h-3 w-3" /> {active.starts_at ? new Date(active.starts_at).toLocaleString() : ""}
              </div>
              <div className="mt-6 text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                Get your picks in before the whistle: outright champion, stage reachers (Final / Semi / Quarter), per-match winners, and specific stage eliminations.
              </div>
            </Card>
          ) : (
            <Card className="glass p-8 border-primary/30 text-center">
              <div className="flex items-center justify-center gap-2 text-destructive mb-2">
                <Radio className="h-5 w-5 animate-pulse" />
                <span className="font-black uppercase tracking-widest">Tournament live</span>
              </div>
              <div className="font-display text-2xl font-black">{active.name ?? "Championship"}</div>
              <p className="text-xs text-muted-foreground mt-2">Current stage: {active.current_stage ?? "R16"}</p>
              <p className="text-sm text-muted-foreground mt-6 max-w-md mx-auto leading-relaxed">
                Live bracket board is being wired up — bracket display, per-round shootouts and inter-stage 20-second brackets ship in the next build.
              </p>
            </Card>
          )}
        </div>
      </PageShell>
    </Layout>
  );
}