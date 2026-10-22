import { lazy, Suspense, useMemo } from 'react';
import type { BadgeData } from '../../../convex/lib/profile';
import type { BadgeDesignId } from './badgeDesigns';
import { hasWebGL, prefersReducedMotion, shouldUse3D } from './badgeSupport';
import type { Faces } from './badgeFaces';
import { useBadgeFaces } from './useBadge';

// El 3D (three.js) va en su propio paquete: no entra en el paquete principal y solo se descarga al mostrar un carné.
const Lanyard = lazy(() => import('../../reactbits/Lanyard/Lanyard'));

export type IdBadgeVariant = 'panel' | 'column';

/** Píxeles de pantalla que puede tener el lienzo de la columna (ya multiplicados por la resolución). */
const COLUMN_PIXELS = 5e6;

const label = (data: BadgeData) => `Carné de ${data.name}, ${data.roleLabel.toLowerCase()}${data.program ? ` de ${data.program}` : ''}`;

/** ¿Este navegador muestra el carné en 3D? (WebGL disponible y sin «reducir movimiento».) */
export function useBadge3D(): boolean {
  return useMemo(() => shouldUse3D({ webgl: hasWebGL(), reducedMotion: prefersReducedMotion(), scriptLoaded: true }), []);
}

function Flat({ faces, name }: { faces: Faces; name: string }) {
  return <img className="badge-flat" src={faces.front} alt={`Carné de ${name}`} />;
}

type IdBadgeProps = {
  data: BadgeData;
  design: BadgeDesignId;
  /** `panel`: dentro de «Mi perfil», centrado. `column`: la columna de la Bitácora, anclado a la derecha y con cinta más delgada. */
  variant?: IdBadgeVariant;
  /** Escala de las caras: 2 = 2048 × 2880 (nítido al acercar). */
  scale?: number;
  /** Dónde cuelga la cinta, como fracción (0 a 1) del ancho del lienzo. Por omisión: al centro en el panel y a la derecha en la columna. */
  anchor?: number;
  /** Tamaño del carné y largo de la cinta (fracciones del alto del lienzo): la columna los ajusta a su lienzo. */
  size?: number;
  strapLength?: number;
  stageId?: string;
};

/**
 * El carné de la persona: 3D (cinta que cuelga, se arrastra, se lanza y gira al pulsarlo) cuando el navegador tiene WebGL y
 * no se pidió reducir el movimiento (con «reducir movimiento» no hay 3D ni halo animado); si no, la imagen plana del frente.
 */
export function IdBadge({ data, design, variant = 'panel', scale = 2, anchor, size = 0.66, strapLength = 0.5, stageId }: IdBadgeProps) {
  const faces = useBadgeFaces(data, design, scale);
  const use3D = useBadge3D();

  return (
    <div className="badge-stage" id={stageId} role="img" aria-label={label(data)} data-mode={faces && use3D ? '3d' : 'flat'}>
      {faces &&
        (use3D ? (
          // Mientras baja el 3D: en el panel se ve la imagen plana; en la columna no se muestra nada (el lienzo ocupa toda la pantalla).
          <Suspense fallback={variant === 'column' ? null : <Flat faces={faces} name={data.name} />}>
            <Lanyard
              frontImage={faces.front}
              backImage={faces.back}
              strapImage={faces.strap}
              cardColor={faces.cardColor}
              finish={faces.finish}
              fx={faces.fx}
              metal="silver"
              size={size}
              anchor={anchor ?? (variant === 'column' ? 'right' : 'center')}
              strapLength={strapLength}
              strapWidth={variant === 'column' ? 0.5 : 0.7}
              breeze={0.3}
              // Solo la columna de la Bitácora limita hasta dónde llega el carné: en el panel (angosto) el límite chocaba con la cuerda.
              bounds={variant === 'column'}
              // El lienzo de la columna es enorme (toda la pantalla y más): más píxeles de presupuesto para que el carné no se vea borroso.
              pixelBudget={variant === 'column' ? COLUMN_PIXELS : undefined}
            />
          </Suspense>
        ) : (
          <Flat faces={faces} name={data.name} />
        ))}
    </div>
  );
}
