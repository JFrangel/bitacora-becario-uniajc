# Guía del corte: de la hoja de Google a la aplicación nueva

Esta guía es para **la dueña** de la bitácora. Casi todo el código ya está hecho y probado; lo que sigue son los pasos que
solo puedes hacer tú porque usan **tus cuentas** (Convex, Google, Netlify). Ninguna clave o secreto va al repositorio:
todas se cargan en los paneles de cada servicio.

> **Antes de empezar:** el archivo `client_secret_*.json` que Google deja en tu carpeta de Descargas **se queda fuera del
> repositorio** (y no hace falta abrirlo para nada: solo copias dos valores en Convex, ver el paso 3).

Tiempo aproximado: 1 hora si todo sale a la primera. Haz los pasos en orden; cada uno dice cómo comprobar que quedó bien.

## 0. Qué tienes y qué falta

| Ya está | Falta (lo haces tú) |
|---|---|
| Aplicación en `app/` (tablero, calendario, Bitácora, historial, carné 3D, enlace de solo lectura) | Crear el proyecto de Convex (desarrollo y producción) |
| Servidor en `app/convex/` y todas sus pruebas automáticas | Credenciales de Google (cliente OAuth) |
| `app/netlify.toml` con la política de seguridad y el comando de construcción | Variables de entorno en Convex y en Netlify |
| `scripts/migrate-legacy.ts` (probado con datos de ejemplo y en modo de solo lectura contra tu hoja) | Ejecutar la migración real y recorrer la lista de verificación |

### Dónde quedó (22 de octubre de 2026)

Convex ya existe: desarrollo `frugal-monitor-317` (funciona: sesión con Google, foto de perfil, 6 actividades migradas) y
producción `agile-wolverine-58` (vacía: sin funciones ni variables). El paquete de producción se construye y pasa
`scripts/check-build.mjs`. Para publicar solo faltan estos pasos, en este orden:

1. **Variables de producción (un comando):** `node scripts/setup-prod-env.mjs https://bitacora-becario-uniajc.netlify.app`
   (usa la dirección de tu sitio de Netlify). Crea claves de sesión nuevas y copia de desarrollo el cliente de Google y
   `OWNER_EMAIL`, sin imprimir nada.
2. **Consola de Google** (el mismo cliente OAuth): agrega el origen `https://bitacora-becario-uniajc.netlify.app` y el URI de
   redirección `https://agile-wolverine-58.convex.site/api/auth/callback/google`.
3. **Netlify:** *Base directory* `app` y la variable `CONVEX_DEPLOY_KEY` (panel de Convex → producción → *Generate Production
   Deploy Key*). El primer despliegue sube las funciones del servidor y la aplicación.
4. Entra una vez con tu cuenta en el sitio publicado y corre
   `node scripts/migrate-legacy.ts --prod --owner-email josepadillacontacto@gmail.com`; las comparaciones deben salir con ✔.
5. Cuando todo esté bien, apaga el Apps Script y el acceso público a Drive (siempre al final).

## 1. Crear el proyecto de Convex

Necesitas Node 20 o más nuevo. En una terminal, dentro de `app/`:

```bash
npm install
npx convex dev
```

La primera vez pide iniciar sesión (ya lo hiciste) y **autorizar la creación del proyecto**: acepta, ponle un nombre
(por ejemplo `bitacora`) y deja que cree el despliegue de **desarrollo**. El comando se queda corriendo y reemplaza los
archivos de `convex/_generated/` por los oficiales; déjalo abierto en esa terminal.

Comprueba: aparece `.env.local` con `VITE_CONVEX_URL=https://…convex.cloud` (ese archivo **no** se sube al repositorio).

El despliegue de **producción** se crea solo la primera vez que se despliega (paso 7).

## 2. Claves de sesión de Convex Auth y `SITE_URL`

Convex Auth firma las sesiones con un par de claves. La forma más corta (en otra terminal, dentro de `app/`):

```bash
npx @convex-dev/auth
```

Responde las preguntas (el sitio de desarrollo es `http://localhost:5173`). Genera `JWT_PRIVATE_KEY` y `JWKS` y define
`SITE_URL` **en Convex**. Si prefieres hacerlo a mano está en <https://labs.convex.dev/auth/setup/manual>.

Comprueba: en el panel de Convex → tu proyecto → *Settings → Environment Variables* (desarrollo) existen `JWT_PRIVATE_KEY`,
`JWKS` y `SITE_URL`.

## 3. Credenciales de Google (cliente OAuth)

1. Entra a <https://console.cloud.google.com/> → crea un proyecto (o usa uno) → *APIs y servicios → Pantalla de
   consentimiento de OAuth*: tipo **Externo**, nombre de la aplicación «Bitácora», tu correo como contacto. Mientras esté en
   «Prueba» agrega como usuarios de prueba **tu cuenta y las de las personas que invitarás**, o publica la aplicación.
2. *Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web*.
3. **Orígenes de JavaScript autorizados:** `http://localhost:5173` (desarrollo) y, en producción, la dirección de Netlify
   (por ejemplo `https://bitacora-becario-uniajc.netlify.app`).
4. **URI de redirección autorizados:** la de tu despliegue de Convex, que es la URL de `.convex.cloud` cambiando `.cloud`
   por `.site` y agregando `/api/auth/callback/google`. Ejemplo:
   `https://fast-horse-123.convex.site/api/auth/callback/google`. Desarrollo y producción tienen **URL distintas**: agrega las dos.
5. Copia el **ID de cliente** y el **secreto** y cárgalos en Convex (el secreto solo se escribe aquí, nunca en un archivo):

```bash
npx convex env set AUTH_GOOGLE_ID <el-id-de-cliente>
npx convex env set AUTH_GOOGLE_SECRET <el-secreto>
npx convex env set OWNER_EMAIL <tu-correo-de-google>
```

`OWNER_EMAIL` es la **única** cuenta que puede ser la dueña: cualquier otra cuenta de Google que entre sin invitación ve
«Tu cuenta no tiene acceso».

Comprueba (`npx convex env list`): `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `OWNER_EMAIL`, `SITE_URL`, `JWT_PRIVATE_KEY`, `JWKS`.

## 4. Probar en desarrollo

Con `npx convex dev` corriendo, en otra terminal:

```bash
npm run dev
```

Abre <http://localhost:5173>, pulsa **Entrar con Google** con la cuenta de `OWNER_EMAIL`: debes ver el tablero vacío. Crea
una tarea de prueba, muévela, completa una y revisa que aparezca un borrador en la Bitácora. Abre «Mi perfil» y comprueba el
carné.

Si algo no abre, `npx convex logs` muestra el error del servidor y la consola del navegador (F12) el del cliente.

## 5. Netlify

1. En Netlify, tu sitio → *Site configuration → Build & deploy → Build settings*: **Base directory** `app`. El comando
   (`npx convex deploy --cmd 'npm run build'`) y la carpeta `dist` ya están en `app/netlify.toml`.
2. En el panel de Convex, **producción** → *Settings → General → Generate Production Deploy Key* (con el permiso
   `deployment:deploy`). Cópiala en Netlify → *Environment variables* como **`CONVEX_DEPLOY_KEY`**.
3. **Reemplaza la política de seguridad:** al apuntar a `app/`, Netlify usa el `netlify.toml` de `app/`, que ya trae la nueva
   (sin Google Apps Script ni Drive; solo `*.convex.cloud`). Comprueba en *Deploys* que el sitio nuevo usa ese archivo.

## 6. Variables de Convex en producción

Las mismas del paso 3 pero **en el despliegue de producción** (`--prod`), con `SITE_URL` igual a la dirección de Netlify:

```bash
npx convex env set --prod AUTH_GOOGLE_ID <el-id-de-cliente>
npx convex env set --prod AUTH_GOOGLE_SECRET <el-secreto>
npx convex env set --prod OWNER_EMAIL <tu-correo-de-google>
npx convex env set --prod SITE_URL https://bitacora-becario-uniajc.netlify.app
```

Y las claves de sesión de producción (`JWT_PRIVATE_KEY`, `JWKS`): repite el paso 2 eligiendo el despliegue de producción, o
carga los valores en el panel. **No** definas `E2E_ENABLED` en producción: es lo que mantiene apagadas las funciones de prueba.

## 7. Primer despliegue

En Netlify → *Deploys → Trigger deploy*. El comando publica las funciones del servidor en Convex producción, construye la
aplicación con su dirección y la sube. Entra con tu cuenta: **este primer inicio de sesión crea tu registro de dueña**
(hazlo antes de migrar: la migración necesita que exista).

Comprueba: la dirección de Netlify abre «Entrar con Google», y con tu cuenta ves el tablero.

## 8. Migrar la hoja de Google

Se hace una vez, **el día del corte**, para que las cifras estén al día. Desde `app/`:

```bash
node scripts/migrate-legacy.ts --dry-run
```

Solo lee tu hoja pública y muestra su informe sin tocar Convex. La referencia del 21 de octubre de 2026 fue
**6 registros, 17,5 horas, 6 completadas** (se vuelven a leer el día del corte; pueden haber cambiado). Si todo está bien,
la migración real. Primero entras tú a la aplicación con Google (paso 7) y después se corre, diciéndole **a qué correo se
enlaza** la Bitácora:

```bash
node scripts/migrate-legacy.ts --prod --owner-email tu-correo@gmail.com
```

La Bitácora migrada queda enlazada **solo a esa cuenta**: el servidor se niega a importar si el correo no es el de la cuenta
que ya entró como dueña (ni el de `OWNER_EMAIL`). Después, cualquier otra persona que entre con su cuenta de Google solo ve
lo que le toca: una persona invitada tiene su propio nombre y rol, no ve la Bitácora ni las horas, y una cuenta sin invitación
no ve nada ni puede convertirse en dueña (hay pruebas automáticas de esto).

Copia los registros (con sus fechas originales), crea los proyectos y copia las imágenes de Drive a Convex con su
miniatura. Es **idempotente**: si se interrumpe, se vuelve a ejecutar sin duplicar nada. Al final imprime una
**comparación** origen contra importado (registros, horas, completadas, fechas y proyectos): todas deben salir con ✔. Cualquier
imagen que no se pudo copiar conserva su dirección de Drive y aparece como «IMAGEN SIN COPIAR».

## 9. Recorrido con dos cuentas reales de Google

Las pruebas automáticas no pueden iniciar sesión con Google, así que este recorrido lo haces tú una vez (necesitas una
segunda cuenta de Google, por ejemplo la de alguien de confianza o una tuya aparte). Marca cada punto:

- [ ] **1.** Entras con tu cuenta. Una tercera cuenta de Google sin invitación ve «Tu cuenta no tiene acceso» y ningún dato.
- [ ] **2.** *Mi perfil → Acceso* (o «Invitar») → creas una invitación y la abres en **otro navegador** con la segunda cuenta: pide
  iniciar sesión con Google, confirma nombre y rol y entra. El mismo enlace **no** sirve una segunda vez.
- [ ] **3.** La segunda cuenta ve tablero, calendario e historial; puede crear (solo con nombre y proyecto), editar, mover y asignar
  tareas, y puede invitar. **No** ve la Bitácora, ni horas, ni borradores, y no puede eliminar tareas.
- [ ] **4.** Tú ves quién invitó a quién (con el correo) y **retiras** a la segunda persona: su aplicación abierta dice «Tu acceso
  ya no está activo.» al instante.
- [ ] **5.** Moviendo una tarea en un navegador, el otro la ve cambiar al instante (arrastre, menú «Mover a…» y teclado).
- [ ] **6.** Completas una tarea tuya: aparece **un** borrador en tu Bitácora; los de otras personas o sin responsable no crean borrador.
  Lo documentas con horas y resultado y suma a los indicadores.
- [ ] **7.** *Acceso → enlace de solo lectura*: lo activas, lo abres en una ventana privada: ves todo (incluida la Bitácora y tu carné)
  sin ningún control de edición. Lo desactivas y la ventana muestra «Este enlace ya no está activo».
- [ ] **8.** *Mi perfil → Editar perfil*: cambias nombre, rol, semestre, programa, institución, grupo y subes y encuadras tu foto. El
  carné se actualiza; en el enlace de solo lectura (con ese diseño local) también.
- [ ] **9.** Los seis temas (Grafito, Papel, Tinta viva × oscuro y claro) se ven bien y se conservan al recargar. En móvil (375 px) no hay
  desborde horizontal.
- [ ] **10.** Con la política de seguridad de Netlify activa, el carné 3D se ve y se mueve (si no se ve, abre F12 → Consola y copia el
  mensaje «Content Security Policy»: es lo único que hay que ajustar en `netlify.toml`).

Si quieres además las pruebas de extremo a extremo automáticas (tablero, enlace de solo lectura, temas, móvil y rendimiento),
están en `app/e2e/` y se corren contra un despliegue de **desarrollo** con `E2E_ENABLED=1`: ver `playwright.config.ts`.

## 10. Apagar lo anterior

Solo cuando todo lo de arriba esté bien:

1. Deshabilita el despliegue del servicio de **Apps Script** (el PIN deja de existir). La hoja de Google se conserva como respaldo.
2. Retira el acceso público de la **carpeta de Drive** con las evidencias (las imágenes ya están en Convex).
3. En Netlify, el sitio ya sirve la aplicación nueva; la versión estática anterior (carpeta raíz del repositorio) deja de usarse.

## Si algo sale mal

- **«Entrar con Google» devuelve a la pantalla de inicio sin entrar:** casi siempre la URI de redirección (paso 3, punto 4) no coincide
  exactamente con la de ese despliegue, o falta `SITE_URL`/`JWT_PRIVATE_KEY`/`JWKS` en ese despliegue.
- **«Tu cuenta no tiene acceso» con tu propia cuenta:** `OWNER_EMAIL` no es exactamente el correo de esa cuenta de Google.
- **Pantalla «Falta conectar la base de datos»:** la construcción se hizo sin `VITE_CONVEX_URL` (en Netlify se define sola con
  `npx convex deploy --cmd …`; en tu equipo, con `npx convex dev`).
- **La migración dice «Primero la dueña debe entrar una vez con Google»:** entra a la aplicación con tu cuenta (paso 7) y repite.
- **Quiero repetir la migración:** se puede, no duplica registros.
