"use client"

/**
 * Guía de consulta (usuario + agentes IA).
 * Acceso: MÁS → CÓMO FUNCIONA
 * Sincronizada con AI_INSTRUCTIONS_DINERO.md
 */

export function HowItWorksScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-8 pt-3">
      <header className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Guía</p>
        <h1 className="text-xl font-extrabold text-white">Cómo funciona Copiloto</h1>
        <p className="mt-1 text-[12px] leading-snug text-neutral-400">
          Register estilo Quicken (todo el banco visible y editable), clasificación Business/Personal,
          transfers sin duplicar ingresos, reconciliación diaria con aprobación antes de aplicar.
          Para ti y para cualquier agente de IA.
        </p>
      </header>

      <Section title="1. Pantallas principales">
        <P>
          <B>HOY</B> — entradas del día (viajes). <B>COBROS</B> — ingresos por plataforma y
          reconciliación. <B>DINERO</B> — Ledger (registers por cuenta + flujo proyectado).{" "}
          <B>REPORTES</B> — resúmenes. En <B>MÁS</B>: Gastos, Panel, Copiloto IA, Datos, esta guía.
        </P>
      </Section>

      <Section title="2. Dual Register (DINERO)">
        <P>
          Hay dos capas: <B>Real / Posted</B> (ya en el banco / ya gastado) y <B>Projected</B> (por
          llegar o por pagar). Borrar o editar una proyección no debe alterar el saldo real del
          banco hasta que marques la línea como Posted / Receipt.
        </P>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Bill</B> = por pagar (EZPass, Tower, facturas) → projected
          </li>
          <li>
            <B>Receipt</B> = ya pagado / en el statement → posted + foto si se escaneó
          </li>
        </ul>
      </Section>

      <Section title="3. Reconciliar COBROS → DINERO">
        <ol className="list-decimal space-y-2 pl-4 text-[12px] text-neutral-300">
          <li>
            Entra en <B>COBROS</B> y elige el día.
          </li>
          <li>Revisa ingresos por plataforma (puedes editar si faltó un viaje o un fee).</li>
          <li>
            Toca <B>Reconciliar día → DINERO</B>.
          </li>
          <li>
            El sistema <B>reemplaza</B> la proyección programada de ese día (ej. $400) por la suma
            real neta del día. No apila duplicados (IDs fijos por día + plataforma).
          </li>
          <li>Después puedes editar cualquier línea del ledger si algo quedó mal.</li>
        </ol>
      </Section>

      <Section title="4. Escanear documentos">
        <P>
          Al escanear debes elegir: <B>Bill o Receipt</B>, y <B>Business o Personal</B>. Business y
          Personal se llevan por separado en reportes. EZPass / Tower suelen ser <B>Bill + Business</B>.
        </P>
        <P>
          Si la IA se equivoca en el OCR, corrige antes de guardar o después en el register (todo es
          editable).
        </P>
      </Section>

      <Section title="5. Editar el ledger">
        <ul className="list-disc space-y-1 pl-4 text-[12px] text-neutral-300">
          <li>Tap en una fila → modal (vendor, monto, fecha, Bill/Receipt, Business/Personal, categoría).</li>
          <li>Datos en el teléfono: localStorage <code className="text-yellow-400/90">claris_cash_flow_entries</code>.</li>
        </ul>
      </Section>

      <Section title="6. Para agentes de IA">
        <P>
          Lee el archivo del repo <B>AI_INSTRUCTIONS_DINERO.md</B> (fuente de verdad para agentes).
          Reglas clave: proponer match/clasificación/reconciliación diaria;{" "}
          <B>no grabar cambios masivos sin aprobación del dueño</B>; register completo visible;
          transfers ≠ ingreso; proyección del día se reemplaza, no se apila; reportes solo con
          datos clasificados (categoría + Business/Personal); zero data loss; no inventar OCR.
        </P>
      </Section>

      <Section title="7. Registers por cuenta">
        <P>
          En DINERO, cada banco/tarjeta tiene su register. Toca la tarjeta de la cuenta para ver el
          movimiento completo de esa cuenta (como Quicken).
        </P>
      </Section>

      <Section title="8. Transferencias">
        <P>
          Transfer = dinero entre <B>tus</B> cuentas. Nunca infla ingresos. Pagar la tarjeta desde
          checking no es un gasto de categoría otra vez.
        </P>
      </Section>

      <Section title="9. Vencimientos">
        <P>
          Cada tarjeta puede tener día de pago. La portada muestra próximos vencimientos para pagar a
          tiempo.
        </P>
      </Section>

      <Section title="10. Proyecciones">
        <P>
          Flujo proyectado compartido (por fecha, con weekday en inglés: Monday, Tuesday…). Al
          reconciliar el día, la proyección de ingreso se <B>sustituye</B> por los ingresos reales
          externos.
        </P>
      </Section>

      <Section title="14. Register = verdad del banco (como Quicken)">
        <P>
          Cada cuenta tiene su <B>register</B> con <B>todas</B> las transacciones del banco: fecha,
          detalle, monto y saldo que corre — no solo "unmatched transfers".
        </P>
        <P>
          El asistente clasifica y propone; <B>nunca oculta</B> el movimiento del banco. Tú siempre
          verificas y corriges con un tap.
        </P>
        <P>
          Cabecera fija (cuenta + balance) y lista con <B>scroll dentro de una caja</B>.
        </P>
      </Section>

      <Section title="15. Aprobación antes de cambios del asistente">
        <P>
          La IA puede <B>proponer automáticamente</B>: categorías, Business/Personal, emparejar
          transfers, reemplazar proyección del día, lista de lo que falta clasificar.
        </P>
        <P>
          <B>No aplica cambios en bloque al ledger</B> hasta que tú apruebes (Approve / Approve all /
          editar antes). Cualquier fila sigue editable a mano.
        </P>
      </Section>

      <Section title="16. Reconciliación diaria (método del asistente)">
        <ol className="list-decimal space-y-1.5 pl-4 text-[12px] text-neutral-300">
          <li>Sync del banco → líneas en cada register.</li>
          <li>Proponer tipo: ingreso / gasto / transfer.</li>
          <li>Proponer categoría + Business o Personal.</li>
          <li>Proponer pares de transfer (mismo monto, cuentas distintas).</li>
          <li>
            <B>Reemplazar</B> la proyección de ingreso del día por la suma real de ingresos externos
            (nunca apilar).
          </li>
          <li>Cerrar gastos proyectados cuando aparece el cargo real.</li>
          <li>Informar qué queda sin clasificar o sin emparejar.</li>
          <li>Esperar tu aprobación antes de grabar cambios masivos.</li>
        </ol>
      </Section>

      <Section title="17. Por qué importa clasificar">
        <P>
          Reportes (gasto por categoría, ingreso por plataforma, Business vs Personal) y análisis de
          la IA <B>solo son fiables</B> si el día está reconciliado y clasificado. Si falta
          clasificación, debe decir cuántas líneas faltan — no inventar totales.
        </P>
      </Section>

      <Section title="18. Transfers ≠ ingreso">
        <P>
          Ingreso = dinero de <B>fuera</B>, una sola vez donde entró. Transfer = entre <B>tus</B>{" "}
          cuentas. No suma a "cuánto generé".
        </P>
      </Section>

      <p className="mt-6 text-center text-[10px] text-neutral-600">
        Copiloto Dual Register · guía in-app · ver también AI_INSTRUCTIONS_DINERO.md
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 rounded-2xl border border-neutral-800 bg-neutral-950/80 p-3.5">
      <h2 className="mb-2 text-[13px] font-extrabold text-white">{title}</h2>
      {children}
    </section>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="mb-2 text-[12px] leading-relaxed text-neutral-300 last:mb-0">{children}</p>
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold text-yellow-400/95">{children}</strong>
}
