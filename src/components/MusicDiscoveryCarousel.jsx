import CircularCarousel from './CircularCarousel';

const BASE = import.meta.env.BASE_URL;

// Keep artwork paths under Vite's base URL for both local and GitHub Pages builds.
const items = [
  {
    src: `${BASE}assets/images/valley.jpg`,
    alt: 'Mist drifting through a valley',
    title: 'Valley',
    subtitle: 'Landscape'
  },
  {
    src: `${BASE}assets/images/portrait.jpg`,
    alt: 'A studio portrait',
    title: 'Portrait',
    subtitle: 'Studio'
  },
  {
    src: `${BASE}assets/images/towers.jpg`,
    alt: 'Glass towers from street level',
    title: 'Towers',
    subtitle: 'Architecture'
  }
];

export default function MusicDiscoveryCarousel() {
  return (
    <section className="section container carousel-showcase" aria-labelledby="carousel-showcase-title">
      <div className="section-head">
        <div>
          <div className="kicker">VISUAL DISCOVERY</div>
          <h2 id="carousel-showcase-title">Creativity in <em>motion.</em></h2>
        </div>
        <p>Explore the places and portraits that inspire new stories, new sounds and new perspectives.</p>
      </div>
      <div className="carousel-stage" style={{ width: '100%', height: '560px', position: 'relative' }}>
        <CircularCarousel
          items={items}
          preset="cylinder"
          intro="rise"
          cardWidth={268}
          aspectRatio={1}
          speed={14}
          captions
          gap={45}
        />
      </div>
      <p className="carousel-hint">Drag, swipe or use the arrow keys to explore.</p>
    </section>
  );
}
