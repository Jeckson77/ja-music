import CircularCarousel from './CircularCarousel';

// Editorial album discovery only; artwork is hosted by its original providers.
// Albums are not available for streaming or purchase through the Ja Music prototype.
const items = [
  {src:'https://i.scdn.co/image/ab67616d0000b27344a8f1e132a7fddf5d4a0ade',alt:'Gazza — Misunderstood album cover',title:'Misunderstood',subtitle:'Gazza · 2018'},
  {src:'https://www.namibiana.de/media/catalog/product/1/7/17030-beautiful-world-cd-elemotho.jpg',alt:'Elemotho — Beautiful World album cover',title:'Beautiful World',subtitle:'Elemotho · 2017'},
  {src:'https://is1-ssl.mzstatic.com/image/thumb/Music126/v4/27/a6/e3/27a6e37a-baa3-c1fa-9c60-3f10e888c4c9/artwork.jpg/3000x3000bb.jpg',alt:'Sally Boss Madam — My Black album cover',title:'My Black',subtitle:'Sally Boss Madam · 2017'}
];

export default function MusicDiscoveryCarousel() {
  return (
    <section className="section container carousel-showcase" aria-labelledby="carousel-showcase-title">
      <div className="section-head">
        <div>
          <div className="kicker">NAMIBIAN ALBUM SPOTLIGHT</div>
          <h2 id="carousel-showcase-title">Real albums. <em>Local legends.</em></h2>
        </div>
        <p>Discover real releases by Namibian artists. Featured for editorial discovery; not available to stream or buy in this prototype.</p>
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
      <p className="carousel-hint">Drag, swipe or use the arrow keys to explore. Album art belongs to its respective rights holders.</p>
    </section>
  );
}
