import Link from "next/link";
import type { ReactNode } from "react";

export function cn(...v: Array<string | false | null | undefined>) {
  return v.filter(Boolean).join(" ");
}

/* ------------------------------- Logo ----------------------------------- */
const logoAlturas = { sm: "h-6", md: "h-8", lg: "h-10", xl: "h-12" } as const;
const logoTextos = {
  sm: "text-[9px] pl-2",
  md: "text-[10px] pl-2.5",
  lg: "text-[12px] pl-3",
  xl: "text-[14px] pl-3.5",
} as const;

/**
 * A marca completa: o brasão + "Academy".
 *
 * `completa` força as duas metades a aparecerem sempre. No cabeçalho o texto
 * some no celular para caber; num certificado ele nunca pode sumir — é o que
 * diz de quem é o documento.
 */
export function Logo({
  variant = "dark",
  size = "md",
  completa,
  className = "",
}: {
  variant?: "dark" | "light";
  size?: keyof typeof logoAlturas;
  completa?: boolean;
  className?: string;
}) {
  const gap = size === "xl" || size === "lg" ? "gap-3" : "gap-2.5";
  return (
    <span className={cn("inline-flex items-center", gap, className)}>
      {/* A arte da marca tem o texto "CASTELO BRANCO" em branco — ele existe
          para fundo escuro. Sobre fundo claro ele sumia, e sobrava um leão
          solto. A versão escura põe a marca numa placa navy, que é como ela
          aparece em papel timbrado. */}
      <span
        className={cn(
          "inline-flex items-center",
          variant === "dark" && "rounded-lg bg-navy-700 px-2.5 py-1.5"
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logoCastelo.png"
          alt="Castelo Branco"
          className={cn(logoAlturas[size], "w-auto", variant === "light" && "brightness-0 invert")}
        />
      </span>
      <span
        className={cn(
          "border-l font-bold uppercase leading-tight tracking-[0.18em]",
          logoTextos[size],
          completa ? "block" : "hidden sm:block",
          variant === "light"
            ? "border-white/25 text-gold-200"
            : "border-navy-200 text-gold-500"
        )}
      >
        Academy
      </span>
    </span>
  );
}

/* ------------------------------ Botões ---------------------------------- */
type BtnProps = {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "primary" | "gold" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
  disabled?: boolean;
  full?: boolean;
  /** Só faz sentido junto de `href`. Abre em outra aba com `rel` seguro. */
  target?: "_blank";
  title?: string;
};

const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-400";

const btnVariants: Record<string, string> = {
  primary: "bg-navy-700 text-white hover:bg-navy-600 shadow-lg shadow-navy-700/20",
  gold: "gold-gradient text-navy-800 hover:brightness-105 shadow-lg shadow-gold-400/30",
  ghost: "text-navy-700 hover:bg-navy-50",
  outline: "border border-navy-200 text-navy-700 hover:border-gold-400 hover:text-gold-600 bg-white",
  danger: "bg-red-500 text-white hover:bg-red-600",
};

const btnSizes: Record<string, string> = {
  sm: "px-3.5 py-1.5 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-3.5 text-sm",
};

export function Button({
  children,
  href,
  onClick,
  type = "button",
  variant = "primary",
  size = "md",
  className = "",
  disabled,
  full,
  target,
  title,
}: BtnProps) {
  const cls = cn(btnBase, btnVariants[variant], btnSizes[size], full && "w-full", className);
  if (href) {
    return (
      <Link
        href={href}
        title={title}
        target={target}
        rel={target === "_blank" ? "noopener noreferrer" : undefined}
        className={cls}
      >
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} title={title} className={cls}>
      {children}
    </button>
  );
}

/* ------------------------------- Badge ---------------------------------- */
export function Badge({
  children,
  tone = "navy",
  className = "",
}: {
  children: ReactNode;
  tone?: "navy" | "gold" | "green" | "muted" | "teal" | "red";
  className?: string;
}) {
  const tones: Record<string, string> = {
    navy: "bg-navy-50 text-navy-700 border-navy-100",
    gold: "bg-gold-50 text-gold-600 border-gold-200",
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    muted: "bg-slate-100 text-slate-600 border-slate-200",
    teal: "bg-teal/10 text-teal border-teal/25",
    red: "bg-red-50 text-red-600 border-red-200",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------ Progresso -------------------------------- */
export function Progress({
  value,
  className = "",
  tone = "gold",
}: {
  value: number;
  className?: string;
  tone?: "gold" | "navy" | "green";
}) {
  const tones: Record<string, string> = {
    gold: "gold-gradient",
    navy: "bg-navy-700",
    green: "bg-emerald-500",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-navy-100", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", tones[tone])}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/* -------------------------------- Card ----------------------------------- */
export function Card({
  children,
  className = "",
  hover,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 max-w-full rounded-2xl border border-navy-100 bg-white p-4 sm:p-5",
        hover && "card-hover",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------ Section ---------------------------------- */
export function SectionTitle({
  eyebrow,
  title,
  description,
  center,
  light,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  center?: boolean;
  light?: boolean;
}) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      {eyebrow && (
        <p className={cn("eyebrow mb-3", light ? "text-gold-300" : "text-gold-500")}>{eyebrow}</p>
      )}
      <h2
        className={cn(
          "text-balance text-3xl font-bold leading-tight tracking-tight sm:text-4xl",
          light ? "text-white" : "text-navy-700"
        )}
      >
        {title}
      </h2>
      {description && (
        <p className={cn("mt-4 text-[15px] leading-relaxed", light ? "text-navy-100/80" : "text-muted")}>
          {description}
        </p>
      )}
    </div>
  );
}

/* --------------------------- Estado vazio -------------------------------- */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-navy-200 bg-cream/50 px-6 py-16 text-center">
      {icon && <div className="mb-4 text-gold-400">{icon}</div>}
      <p className="text-base font-semibold text-navy-700">{title}</p>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ------------------------------- Avatar ---------------------------------- */
export function Avatar({
  nome,
  size = 40,
  cor = "#00204D",
  url,
}: {
  nome: string;
  size?: number;
  cor?: string;
  /** Foto de perfil, quando existe — conta criada pelo Google traz uma. */
  url?: string;
}) {
  // A foto some quando o provedor expira o link; as iniciais nunca somem.
  // Por isso o fallback não é um alt quebrado, é o avatar de sempre.
  if (url) {
    return (
      <img
        src={url}
        alt={nome}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }
  const iniciais = nome
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, ${cor}, #0d3563)`,
        fontSize: size * 0.36,
      }}
    >
      {iniciais}
    </span>
  );
}

/* -------------------------- Campo de formulário --------------------------- */
export function Field({
  label,
  children,
  hint,
  error,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  error?: string;
  /** Para o campo ocupar mais de uma coluna da grade que o contém. */
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-navy-600">
        {label}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-red-600">{error}</span>}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl border border-navy-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-slate-400 focus:border-gold-400 focus:ring-4 focus:ring-gold-400/15";

/* ----------------------------- Carregando -------------------------------- */
export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-navy-200 border-t-gold-400" />
      <p className="text-sm text-muted">{texto}</p>
    </div>
  );
}
