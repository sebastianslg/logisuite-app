import Link from "next/link";

import { Field, H2, LegalDoc, P, ResponsibleCard, UL } from "@/components/legal/legal-doc";

export const metadata = {
  title: "Política de tratamiento de datos",
  description: "Qué datos personales trata Westvane, para qué, por cuánto tiempo y cómo ejercer tus derechos (Ley 1581 de 2012).",
};

const SECTIONS = [
  { id: "responsable", label: "Responsable" },
  { id: "marco", label: "Marco legal" },
  { id: "datos", label: "Datos que tratamos" },
  { id: "finalidades", label: "Finalidades" },
  { id: "conservacion", label: "Conservación" },
  { id: "derechos", label: "Tus derechos" },
  { id: "procedimiento", label: "Consultas y reclamos" },
  { id: "terceros", label: "Encargados y transferencias" },
  { id: "datos-terceros", label: "Datos de terceros que cargas" },
  { id: "seguridad", label: "Seguridad" },
  { id: "vigencia", label: "Vigencia y cambios" },
];

export default function PrivacidadPage() {
  return (
    <LegalDoc
      doc="privacidad"
      title="Política de tratamiento de datos"
      description="Qué datos personales trata Westvane, para qué, por cuánto tiempo y cómo ejercer tus derechos (Ley 1581 de 2012)."
      sections={SECTIONS}
    >
      {({ responsible: r }) => (
        <>
          <H2 id="responsable">1. Responsable del tratamiento</H2>
          <ResponsibleCard r={r} />

          <H2 id="marco">2. Marco legal</H2>
          <P>
            Esta política cumple la Ley Estatutaria 1581 de 2012 de protección de datos personales y el Decreto 1074 de 2015
            (capítulos 25 y 26 del título 2, parte 2, libro 2), con la vigilancia de la Superintendencia de Industria y
            Comercio (SIC). La aceptación electrónica tiene validez según la Ley 527 de 1999.
          </P>

          <H2 id="datos">3. Datos que tratamos</H2>
          <UL>
            <li><strong>Nombre declarado.</strong> El que escribes como operador para firmar tus cambios. Es opcional; sin él, los cambios quedan como «anónimo».</li>
            <li><strong>Lo que registras.</strong> Notas, incidencias, envíos y documentos adjuntos, que pueden contener datos de otras personas (ver la sección 9).</li>
            <li><strong>Registro de aceptaciones.</strong> Qué documento aceptaste o revocaste, en qué versión y con qué texto, la fecha, un identificador al azar de tu navegador, el tipo de navegador y un resumen irreversible de tu dirección IP (la IP no se guarda en claro).</li>
            <li><strong>Datos técnicos.</strong> Registros de errores del servidor, con tamaño limitado y rotación automática.</li>
          </UL>
          <P>
            No pedimos ni tratamos datos sensibles, datos de niñas, niños o adolescentes, ni datos de pago. Las preferencias de
            la app (tema, moneda, vistas) se guardan solo en tu navegador: ver{" "}
            <Link href="/cookies" className="text-primary underline">Cookies y almacenamiento</Link>.
          </P>

          <H2 id="finalidades">4. Finalidades</H2>
          <UL>
            <li>Operar la app: registrar envíos, notas, incidencias y documentos, y mostrar quién hizo cada cambio (historial).</li>
            <li>Guardar la prueba de tu aceptación y de tu autorización, como exige la ley.</li>
            <li>Proteger el servicio: prevenir abusos (límite de peticiones), investigar fallas y hacer respaldos.</li>
            <li>Atender tus consultas y reclamos.</li>
          </UL>
          <P>No vendemos ni cedemos tus datos, y no los usamos para publicidad ni para perfiles comerciales.</P>

          <H2 id="conservacion">5. Conservación</H2>
          <UL>
            <li>Lo que registras: mientras el envío exista en la app o hasta que pidas su supresión, si no hay un deber legal de conservarlo.</li>
            <li>Registro de aceptaciones: mientras exista la app y el tiempo necesario para atender reclamos o requerimientos de autoridad.</li>
            <li>Respaldos: catorce días; los más antiguos se borran solos.</li>
          </UL>

          <H2 id="derechos">6. Tus derechos</H2>
          <P>Como titular de tus datos tienes derecho a (artículo 8 de la Ley 1581 de 2012):</P>
          <UL>
            <li>Conocer, actualizar y rectificar tus datos.</li>
            <li>Pedir prueba de la autorización que diste.</li>
            <li>Ser informado sobre el uso que se les da.</li>
            <li>Revocar la autorización y pedir la supresión de tus datos cuando no exista un deber legal o contractual de conservarlos.</li>
            <li>Acceder gratis a tus datos.</li>
            <li>Presentar quejas ante la Superintendencia de Industria y Comercio, después de agotar el trámite de consulta o reclamo.</li>
          </UL>
          <P>
            Puedes revocar la autorización en cualquier momento desde <Link href="/configuracion" className="text-primary underline">Configuración</Link>{" "}
            › Privacidad y aceptaciones.
          </P>

          <H2 id="procedimiento">7. Consultas y reclamos</H2>
          <P>
            Escribe a <Field value={r.email} label="correo para solicitudes" /> con tu nombre, cómo contactarte, lo que pides y,
            si es un reclamo, los hechos y los documentos que quieras hacer valer.
          </P>
          <UL>
            <li><strong>Consultas:</strong> se responden en máximo 10 días hábiles; si no es posible, te avisamos el motivo y respondemos en máximo 5 días hábiles más.</li>
            <li><strong>Reclamos</strong> (corrección, actualización, supresión o incumplimiento): se responden en máximo 15 días hábiles, prorrogables 8 días hábiles más avisándote el motivo. Si el reclamo está incompleto, te pediremos completarlo en 5 días; si pasan 2 meses sin respuesta, se entiende desistido.</li>
          </UL>

          <H2 id="terceros">8. Encargados y transferencias</H2>
          <UL>
            <li>
              <strong>Contabo</strong> aloja el servidor donde viven la base de datos, los documentos y los respaldos, como
              encargado del tratamiento. Ubicación del servidor: <Field value={r.server_location} label="país del centro de datos" />.
              Si está fuera de Colombia, es una transmisión internacional de datos que autorizas al aceptar esta política.
            </li>
            <li>
              <strong>OpenFreeMap</strong> sirve el mapa base: tu navegador le pide las imágenes del mapa directamente, así que
              recibe tu dirección IP como cualquier sitio que visitas. No le enviamos ningún otro dato.
            </li>
          </UL>

          <H2 id="datos-terceros">9. Datos de terceros que cargas</H2>
          <P>
            Si registras datos de otras personas (por ejemplo, el nombre o la cédula de un conductor en una remesa), tú eres
            responsable de tener su autorización. La app te pide declararlo al subir documentos o importar archivos y guarda esa
            declaración. Esas personas pueden ejercer ante nosotros los mismos derechos de la sección 6.
          </P>

          <H2 id="seguridad">10. Seguridad</H2>
          <P>
            Conexión cifrada (HTTPS), acceso al servidor solo con llave, cortafuegos, límite de peticiones, revisión del
            contenido de los archivos subidos, respaldos diarios con verificación de integridad y registro de cada cambio.
            Ningún sistema es infalible: si ocurre un incidente que afecte tus datos, te informaremos y lo reportaremos a la SIC
            cuando corresponda.
          </P>

          <H2 id="vigencia">11. Vigencia y cambios</H2>
          <P>
            Esta política rige desde la fecha de su versión. Si cambia de forma sustancial, cambiará su versión y la app te
            pedirá aceptarla de nuevo antes de seguir.
          </P>
        </>
      )}
    </LegalDoc>
  );
}
