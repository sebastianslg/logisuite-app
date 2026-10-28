import { H2, LegalDoc, P } from "@/components/legal/legal-doc";

export const metadata = {
  title: "Cookies y almacenamiento",
  description: "Westvane no usa cookies de seguimiento: solo guarda en tu navegador las preferencias necesarias para funcionar.",
};

const SECTIONS = [
  { id: "resumen", label: "En resumen" },
  { id: "almacenamiento", label: "Qué se guarda" },
  { id: "consentimiento", label: "¿Hace falta aceptar?" },
  { id: "terceros", label: "Terceros" },
  { id: "borrar", label: "Cómo borrarlo" },
];

const KEYS: [string, string][] = [
  ["westvane.browser-id", "Identificador al azar de este navegador, que une tus aceptaciones en el registro"],
  ["westvane.consent", "Copia de qué documentos aceptaste y en qué versión"],
  ["westvane.operator", "El nombre que declaras para firmar tus cambios"],
  ["westvane.theme", "Apariencia: claro, oscuro o la del sistema"],
  ["westvane.currency", "Moneda en pantalla (USD o COP)"],
  ["westvane.shipment-views, westvane.table-density", "Vistas guardadas y densidad de la tabla de envíos"],
  ["westvane.alerts-seen", "Qué avisos ya viste"],
  ["westvane.dashboard-map, westvane:map-quality, westvane:map-anim", "Vista y calidad del mapa"],
  ["westvane:diagnostico", "Si el panel de diagnóstico está abierto"],
];

export default function CookiesPage() {
  return (
    <LegalDoc
      doc="cookies"
      title="Cookies y almacenamiento"
      description="Westvane no usa cookies de seguimiento: solo guarda en tu navegador las preferencias necesarias para funcionar."
      sections={SECTIONS}
    >
      {() => (
        <>
          <H2 id="resumen">1. En resumen</H2>
          <P>
            Westvane <strong>no usa cookies</strong>, ni analítica, ni publicidad, ni píxeles de seguimiento. Guarda unas pocas
            preferencias en el almacenamiento local de tu navegador (localStorage), que nunca se envían a otros sitios.
          </P>

          <H2 id="almacenamiento">2. Qué se guarda en tu navegador</H2>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Clave</th>
                  <th className="px-4 py-2.5 font-medium">Para qué</th>
                </tr>
              </thead>
              <tbody>
                {KEYS.map(([k, v]) => (
                  <tr key={k} className="border-b border-border last:border-0 align-top">
                    <td className="px-4 py-2.5 font-mono text-xs">{k}</td>
                    <td className="px-4 py-2.5">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <P>Se conservan hasta que los borres. Ninguna de estas claves sirve para seguirte en otros sitios.</P>

          <H2 id="consentimiento">3. ¿Hace falta aceptar?</H2>
          <P>
            No. Lo que guarda la app es necesario para que funcione o para recordar lo que tú elegiste, y no se usa para
            perfilarte. Por eso no hay un aviso de cookies. Si algún día se agrega analítica o publicidad, se pedirá tu
            consentimiento antes de activarla.
          </P>

          <H2 id="terceros">4. Terceros</H2>
          <P>
            Al abrir un mapa, tu navegador pide las imágenes del mapa base a OpenFreeMap, que recibe tu dirección IP como
            cualquier sitio web. OpenFreeMap no instala cookies de Westvane ni recibe otros datos tuyos.
          </P>

          <H2 id="borrar">5. Cómo borrarlo</H2>
          <P>
            En tu navegador, borra los datos del sitio (en Chrome y Edge: candado de la barra de direcciones › Configuración del
            sitio › Borrar datos). Se perderán tus preferencias y la app te pedirá aceptar de nuevo los términos; tus
            aceptaciones anteriores siguen en el registro del servidor.
          </P>
        </>
      )}
    </LegalDoc>
  );
}
