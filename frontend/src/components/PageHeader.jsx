import { Link } from "react-router-dom";

export default function PageHeader({ eyebrow, title, subtitle, children }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1>{title}</h1>
          {subtitle && <p className="subtitle">{subtitle}</p>}
        </div>
        <div className="header-actions">{children}</div>
      </div>
    </header>
  );
}

export function BackLink({ to = "/all-servers", label = "← All Servers" }) {
  return (
    <Link to={to} className="btn btn-ghost">
      {label}
    </Link>
  );
}
