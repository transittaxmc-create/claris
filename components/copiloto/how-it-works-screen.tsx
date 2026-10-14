"use client"

/**
 * Guía de consulta (usuario + agentes IA).
 * Acceso: MÁS → CÓMO FUNCIONA
 */

export function HowItWorksScreen() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 pb-8 pt-3">
      <header className="mb-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-yellow-400">Guía</p>
        <h1 className="text-xl font-extrabold text-white">Cómo funciona Copiloto</h1>
        <p className="mt-1 text-[12px] leading-snug text-neutral-400">
          Dual Register, reconciliación COBROS → DINERO, Bill vs Receipt, Business vs Personal.
          Para ti y para cualquier agente de IA.
        </p>
      </header>

      <Section title="1. Pantallas principales">
        <P>
          <B>HOY</B> — entradas del día (viajes). <B>COBROS</B> — ingresos por plataforma y
          reconciliación. <B>DINERO</B> — dual register (banco real + proyecciones).{" "}
          <B>REPORTES</B> — resúmenes. En <B>MÁS</B>: Gastos, Panel, Copiloto IA, Datos, esta guía.
        </P>
      </Section>

      <Section title="2. Dual Register (DINERO)">
        <P>
          Hay dos capas: <B>BANK BALANCE</B> (ya en el banco / ya gastado) y <B>PROJECTED</B> (por
          llegar o por pagar). Borrar o editar una proyección no debe alterar el saldo real del
          banco hasta que marques la línea como Posted / Receipt.
        </P>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Bill</B> = por pagar (Easy Pass, Tower, facturas) → projected
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
          <li>
            Esas líneas quedan como <B>proyección de ingreso</B>. El BANK BALANCE real no cambia
            hasta que el dinero se refleje y lo marques Posted si aplica.
          </li>
        </ol>
        <P>
          Después siempre puedes editar el ledger (tap en la descripción → Save) si aparece un fin
          que no incluiste o un monto incorrecto.
        </P>
      </Section>

      <Section title="4. Escanear documentos">
        <P>
          Al escanear debes elegir: <B>Bill o Receipt</B>, y <B>Business o Personal</B>. Business y
          Personal se llevan por separado en reportes. Easy Pass / peajes tipo Tower suelen ser{" "}
          <B>Bill + Business</B>, no recibo.
        </P>
        <P>
          Si la IA se equivoca en el OCR, corrige en el formulario antes de guardar, o después en el
          General Ledger (todo es editable).
        </P>
      </Section>

      <Section title="5. Editar el ledger">
        <ul className="list-disc space-y-1 pl-4 text-[12px] text-neutral-300">
          <li>
            Tap en la descripción → modal completo (vendor, monto, fecha, Bill/Receipt,
            Business/Personal, categoría, notas).
          </li>
          <li>Monto en la columna Amount → se guarda al salir del campo.</li>
          <li>→ Receipt / → Bill → cambio rápido de tipo.</li>
          <li>
            Datos en el teléfono: localStorage{" "}
            <code className="text-yellow-400/90">claris_cash_flow_entries</code>.
          </li>
        </ul>
      </Section>

      <Section title="6. Para agentes de IA">
        <P>
          Lee también el archivo del repo <B>AI_INSTRUCTIONS_DINERO.md</B>. Reglas: cambios
          quirúrgicos solo en DINERO / scanner / cash-flow-store; zero data loss; reconciliación =
          replace no stack; no inventar montos OCR; no tocar HOY/COBROS/REPORTES salvo el puente de
          reconcile.
        </P>
      </Section>

      <Section title="7. Video / demo (próximo)">
        <P>
          Aquí puede enlazarse un video corto de captura de pantalla (escanear → clasificar →
          reconciliar → editar ledger). Mientras tanto esta guía es la referencia canónica en la
          app.
        </P>
      </Section>

      <p className="mt-6 text-center text-[10px] text-neutral-600">Copiloto Dual Register · guía in-app</p>
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
  return <p className="text-[12px] leading-relaxed text-neutral-300">{children}</p>
}

function B({ children }: { children: React.ReactNode }) {
  return <strong className="font-bold text-yellow-400/95">{children}</strong>
}
