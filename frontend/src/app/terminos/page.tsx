import Link from "next/link";

import { Field, H2, LegalDoc, P, UL } from "@/components/legal/legal-doc";

export const metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso de Westvane: qué es, qué se puede hacer, qué no y quién responde por qué.",
};

const SECTIONS = [
  { id: "quien", label: "Quién presta el servicio" },
  { id: "que-es", label: "Qué es Westvane" },
  { id: "aceptacion", label: "Aceptación y cambios" },
  { id: "uso", label: "Uso permitido" },
  { id: "informacion", label: "Información que cargas" },
  { id: "estimaciones", label: "Estimaciones y límites" },
  { id: "disponibilidad", label: "Disponibilidad" },
  { id: "propiedad", label: "Propiedad intelectual" },
  { id: "precio", label: "Precio" },
  { id: "responsabilidad", label: "Responsabilidad" },
  { id: "ley", label: "Ley aplicable" },
];

export default function TerminosPage() {
  return (
    <LegalDoc
      doc="terminos"
      title="Términos y condiciones"
      description="Condiciones de uso de Westvane: qué es, qué se puede hacer, qué no y quién responde por qué."
      sections={SECTIONS}
    >
      {({ responsible: r }) => (
        <>
          <H2 id="quien">1. Quién presta el servicio</H2>
          <P>
            Westvane es operado por <Field value={r.name} label="nombre o razón social" />, identificado con{" "}
            <Field value={r.id_number} label="cédula o NIT" />, con domicilio en <Field value={r.city} label="ciudad" />, Colombia
            (en adelante, «el responsable»). Para cualquier asunto sobre estos términos escribe a{" "}
            <Field value={r.email} label="correo de contacto" />.
          </P>

          <H2 id="que-es">2. Qué es Westvane</H2>
          <P>
            Westvane es una herramienta de planificación y seguimiento de transporte de carga multimodal (carretera, río, mar,
            aire y ferrocarril) en Colombia. Calcula rutas, costos, tiempos, combustible y huella de carbono, y permite
            registrar envíos, notas, incidencias y documentos.
          </P>
          <P>
            Hoy está en desarrollo: los envíos, clientes, vehículos, bodegas, tarifas y la telemetría que muestra son{" "}
            <strong>datos simulados</strong>, y los nombres de empresas son ficticios.
          </P>

          <H2 id="aceptacion">3. Aceptación y cambios</H2>
          <P>
            Para usar Westvane debes aceptar estos términos y, por separado, autorizar el tratamiento de tus datos según la{" "}
            <Link href="/privacidad" className="text-primary underline">Política de tratamiento de datos</Link>. Cada aceptación
            queda registrada con su fecha, la versión del documento y el texto exacto que aceptaste. Si estos términos cambian,
            la versión cambia y la app te pedirá aceptarlos de nuevo antes de seguir.
          </P>

          <H2 id="uso">4. Uso permitido</H2>
          <P>Puedes usar Westvane para planificar, simular y hacer seguimiento de operaciones de transporte. No puedes:</P>
          <UL>
            <li>Acceder o intentar acceder a datos, cuentas o sistemas sin autorización, ni probar vulnerabilidades sin permiso escrito del responsable (Ley 1273 de 2009).</li>
            <li>Cargar archivos con código malicioso, o con contenido ilegal o que infrinja derechos de terceros.</li>
            <li>Sobrecargar el servicio de forma deliberada o automatizar peticiones masivas.</li>
            <li>Cargar datos personales de terceros sin su autorización, o datos sensibles (salud, biometría, orientación política o religiosa, entre otros).</li>
          </UL>

          <H2 id="informacion">5. Información que cargas</H2>
          <P>
            Eres responsable de la información que registras (envíos, notas, incidencias y documentos adjuntos) y de contar con
            la autorización de las personas cuyos datos aparezcan en ella, por ejemplo conductores o destinatarios en una
            remesa. Al subir un documento o importar un archivo, la app te pide declararlo y guarda esa declaración.
          </P>

          <H2 id="estimaciones">6. Estimaciones y límites</H2>
          <P>
            Las rutas, tiempos, costos, consumos y emisiones son <strong>estimaciones</strong> calculadas con un modelo y
            supuestos públicos (ver <Link href="/metodologia" className="text-primary underline">Metodología</Link>), no
            mediciones. Algunas trazas de la red son aproximadas. Las cotizaciones son referenciales y no constituyen una oferta
            comercial vinculante. Westvane no reemplaza la verificación de condiciones reales de las vías, los permisos de
            transporte ni la asesoría profesional.
          </P>

          <H2 id="disponibilidad">7. Disponibilidad</H2>
          <P>
            El responsable procura que el servicio esté disponible y hace respaldos diarios, pero no garantiza que funcione sin
            interrupciones ni errores. Puede suspenderlo para mantenimiento o por razones de seguridad, y modificar o retirar
            funciones.
          </P>

          <H2 id="propiedad">8. Propiedad intelectual</H2>
          <P>
            El software, el diseño, los textos y los gráficos de Westvane pertenecen al responsable o se usan con licencia.
            Los componentes de terceros (mapas, datos abiertos, tipografías, librerías) se rigen por sus propias licencias,
            listadas en <Link href="/creditos" className="text-primary underline">Créditos y licencias</Link>. La información que
            tú cargas sigue siendo tuya.
          </P>

          <H2 id="precio">9. Precio</H2>
          <P>
            Hoy Westvane es gratuito y no tiene cobros. Si en el futuro hay planes de pago, se informarán el precio y las
            condiciones antes de cualquier cobro, con los derechos que da el Estatuto del Consumidor (Ley 1480 de 2011).
          </P>

          <H2 id="responsabilidad">10. Responsabilidad</H2>
          <P>
            En la medida en que lo permita la ley colombiana, el responsable no responde por decisiones operativas o
            comerciales tomadas solo con base en las estimaciones de la app, ni por daños derivados de un uso contrario a estos
            términos. Nada de esto limita los derechos que la ley te reconoce y que no se pueden renunciar.
          </P>

          <H2 id="ley">11. Ley aplicable</H2>
          <P>
            Estos términos se rigen por las leyes de la República de Colombia. Cualquier controversia se intentará resolver
            primero de forma directa escribiendo a <Field value={r.email} label="correo de contacto" />; si no es posible, la
            conocerán los jueces de <Field value={r.city} label="ciudad" />, Colombia.
          </P>
        </>
      )}
    </LegalDoc>
  );
}
