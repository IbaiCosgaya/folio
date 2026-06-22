import {
  Wand2,
  Rocket,
  Search,
  Siren,
  Ghost,
  Heart,
  Landmark,
  Scroll,
  Backpack,
  Baby,
  Zap,
  Sparkles,
  Compass,
  BookUser,
  PenLine,
  Brain,
  Moon,
  BookOpen,
} from 'lucide-react'

// Fuente única de verdad para géneros en toda la app.
// badge: clases de fondo+texto suave (chips, fondos de portada placeholder)
// solid: clase de fondo sólido (barras de progreso, indicadores)
// spine: hex puro, para estilos inline (lomo de libro, gradientes, SVG)
// description: ayuda a decidir dónde encaja un libro cuando hay duda entre categorías parecidas
export const GENRES = [
  { value: 'fantasia',        label: 'Fantasía',               icon: Wand2,     badge: 'bg-purple-100 text-purple-600',   solid: 'bg-purple-400',   spine: '#7c3aed', description: 'Mundos, magia o criaturas inventadas.' },
  { value: 'ciencia_ficcion', label: 'Ciencia ficción',         icon: Rocket,    badge: 'bg-blue-100 text-blue-600',       solid: 'bg-blue-400',     spine: '#2563eb', description: 'Tecnología, futuro, especulación científica.' },
  { value: 'misterio',        label: 'Misterio',                icon: Search,    badge: 'bg-indigo-100 text-indigo-600',   solid: 'bg-indigo-400',   spine: '#4f46e5', description: 'Investigar y resolver un enigma; menos acción que el thriller.' },
  { value: 'thriller',        label: 'Thriller',                icon: Siren,     badge: 'bg-red-100 text-red-600',         solid: 'bg-red-400',      spine: '#dc2626', description: 'Tensión, persecución, ritmo alto.' },
  { value: 'terror',          label: 'Terror',                  icon: Ghost,     badge: 'bg-orange-100 text-orange-600',   solid: 'bg-orange-400',   spine: '#ea580c', description: 'Busca asustar o inquietar.' },
  { value: 'romance',         label: 'Romance',                 icon: Heart,     badge: 'bg-pink-100 text-pink-600',       solid: 'bg-pink-400',     spine: '#db2777', description: 'La relación amorosa es el eje central.' },
  { value: 'historica',       label: 'Histórica',               icon: Landmark,  badge: 'bg-amber-100 text-amber-700',     solid: 'bg-amber-400',    spine: '#d97706', description: 'Ficción ambientada en un periodo histórico real.' },
  { value: 'clasicos',        label: 'Clásicos',                icon: Scroll,    badge: 'bg-yellow-100 text-yellow-700',   solid: 'bg-yellow-400',   spine: '#a16207', description: 'Obras consagradas, de cualquier época, ya parte del canon.' },
  { value: 'juvenil_ya',      label: 'Juvenil / YA',            icon: Backpack,  badge: 'bg-cyan-100 text-cyan-600',       solid: 'bg-cyan-400',     spine: '#0891b2', description: 'Protagonista adolescente, pensado para público joven-adulto.' },
  { value: 'infantil',        label: 'Infantil',                icon: Baby,      badge: 'bg-lime-100 text-lime-600',       solid: 'bg-lime-400',     spine: '#65a30d', description: 'Dirigido a niños.' },
  { value: 'comic',           label: 'Cómic',                   icon: Zap,       badge: 'bg-fuchsia-100 text-fuchsia-600', solid: 'bg-fuchsia-400',  spine: '#c026d3', description: 'Formato viñeta, origen occidental.' },
  { value: 'manga',           label: 'Manga',                   icon: Sparkles,  badge: 'bg-rose-100 text-rose-600',       solid: 'bg-rose-400',     spine: '#e11d48', description: 'Formato viñeta, origen japonés.' },
  {
    value: 'no_ficcion',
    label: 'No ficción',
    icon: Compass,
    badge: 'bg-teal-100 text-teal-600',
    solid: 'bg-teal-400',
    spine: '#0d9488',
    description: 'Divulgación científica, historia narrativa (no autobiográfica), true crime, periodismo, viajes, negocios — informativo, no protagonizado por la vida del propio autor.',
  },
  { value: 'autobiografia',   label: 'Autobiografía',           icon: BookUser,  badge: 'bg-green-100 text-green-600',     solid: 'bg-green-400',    spine: '#16a34a', description: 'El autor cuenta su propia vida.' },
  { value: 'ensayo',          label: 'Ensayo',                  icon: PenLine,   badge: 'bg-emerald-100 text-emerald-600', solid: 'bg-emerald-400',  spine: '#059669', description: 'Argumentación u opinión personal estructurada sobre un tema.' },
  { value: 'psicologia',      label: 'Psicología',              icon: Brain,     badge: 'bg-sky-100 text-sky-600',         solid: 'bg-sky-400',      spine: '#0284c7', description: 'Mente, comportamiento, autoayuda emocional.' },
  { value: 'poesia',          label: 'Poesía',                  icon: Moon,      badge: 'bg-slate-100 text-slate-600',     solid: 'bg-slate-400',    spine: '#475569', description: 'Verso, lírica.' },
  { value: 'otro',            label: 'Otro',                    icon: BookOpen,  badge: 'bg-stone-100 text-stone-500',     solid: 'bg-stone-400',    spine: '#57534e', description: 'No encaja en ninguna categoría anterior.' },
]

// Acceso rápido por value, p.ej. GENRE_MAP['fantasia']
export const GENRE_MAP = Object.fromEntries(GENRES.map(g => [g.value, g]))

// Helper: icono+color con fallback seguro a "Otro" si el género no existe o es null
export function getGenreStyle(value) {
  return GENRE_MAP[value] || GENRE_MAP.otro
}