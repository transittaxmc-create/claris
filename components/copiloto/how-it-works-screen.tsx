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
          Registers por cuenta, transferencias, vencimientos, proyecciones.
          Para ti, para Amani y para cualquier agente de IA: que nunca se pierda el contexto.
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


      <Section title="8. Registers por cuenta (uno por banco/tarjeta)">
        <P>
          Cada cuenta de banco y cada tarjeta de crédito tiene <B>su propio register</B> con su
          propio balance. Nunca se mezclan bancos en una sola cifra: así cada register cuadra con
          su banco al centavo.
        </P>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Portada</B> (DINERO → Libro Mayor): una tarjeta por cuenta con nombre + balance
            grande. Se deslizan de lado; sin scroll largo.
          </li>
          <li>
            <B>Tocar una tarjeta</B> abre el register de ESA cuenta: balance grande arriba,
            movimientos debajo.
          </li>
          <li>
            <B>Tarjeta de crédito</B>: muestra límite, deuda actual y disponible (límite − deuda).
            La tarjeta es un <B>pasivo</B> (lo que debes), no un activo.
          </li>
          <li>
            <B>Agregar cuenta</B>: botón ＋ en la portada. Su register nace automáticamente. La
            tarjeta pide límite + día de pago.
          </li>
          <li>
            <B>★ Principal</B>: la cuenta principal (CitiBank) es donde corren las proyecciones y
            desde donde se pagan los bills.
          </li>
        </ul>
      </Section>

      <Section title="9. De dónde viene cada dato (una sola puerta)">
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-neutral-300">
          <li>
            <B>Banco (feed)</B>: balances y movimientos reales llegan solos del banco (auto al
            abrir + botón SYNC). <B>No se digitan</B> — lo real no se escribe a mano.
          </li>
          <li>
            <B>Bills escaneados</B> (statements de tarjetas, celulares, carro, TD): entran{" "}
            <B>una sola vez</B> y van a <B>Proyecciones</B> como &quot;por pagar&quot;.
          </li>
          <li>
            <B>Gastos manuales</B>: un solo formulario (Libro Mayor o Mis Gastos) — ambos caen al{" "}
            <B>mismo Libro Mayor</B>. Nada se entra dos veces.
          </li>
        </ul>
        <P>Cada dato vive en un solo lugar. Si ya entró por una puerta, no se repite.</P>
      </Section>

      <Section title="10. Transferencias entre cuentas (sin duplicar ingreso)">
        <P>
          Cuando el dinero sale de una cuenta y entra a otra (mismo monto, fechas cercanas), el
          sistema lo marca como <B>TRANSFERENCIA</B> — nunca como ingreso. Ejemplo: Uber Pro →
          CitiBank. Lo que llega a CitiBank <B>no es un ingreso nuevo</B>: es el mismo dólar
          movido. El ingreso fue lo de Uber.
        </P>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-[12px] text-neutral-300">
          <li>
            Cada transferencia lleva su <B>origen trazado</B> (&quot;viene de Uber Pro&quot;).
          </li>
          <li>
            <B>Reporte de transferencias</B> (botón en la portada): emparejadas para verificar +
            &quot;sueltas&quot; (salida sin llegada o viceversa) para revisar. Sin cabos sueltos.
          </li>
          <li>Regla de oro: los transfers jamás inflan ingresos.</li>
        </ul>
      </Section>

      <Section title="11. Reconciliación automática">
        <P>
          Cuando un pago aparece en el checking (feed del banco), el sistema lo empareja solo con
          su bill o tarjeta y <B>actualiza ambos lados</B>: baja el checking y liquida el bill (o
          baja la deuda de la tarjeta). Los bills liquidados solos aparecen en el reporte de
          transferencias como &quot;Auto-conciliados&quot;.
        </P>
        <P>
          Un pago desde checking a la tarjeta <B>no es un gasto</B>: es una transferencia de
          activo a pasivo (baja el banco, baja la deuda).
        </P>
      </Section>

      <Section title="12. Due days (vencimientos)">
        <P>
          Cada tarjeta/cuenta puede tener su <B>día de pago</B> (se configura en el detalle de la
          cuenta). La portada muestra <B>Próximos vencimientos</B> ordenados por cercanía (¡HOY! /
          en X días) para pagar a tiempo e ir liquidando balances.
        </P>
      </Section>

      <Section title="13. Proyecciones (cuenta principal + otros fondos)">
        <P>
          La proyección corre sobre la <B>cuenta principal</B> (★): balance real + bills por pagar
          = cierre proyectado. Las demás cuentas <B>no mezclan sus movimientos</B>: aportan solo
          su balance como <B>&quot;otros fondos&quot;</B> (checkmark en el detalle de la cuenta
          principal) que suma al proyectado.
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
