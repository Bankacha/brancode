import logoUrl from "../assets/logo.svg";

export default function Logo({ size = 64 }) {
  return <img src={logoUrl} alt="Brancode" width={size} height={size} className="block rounded-toast" />;
}
