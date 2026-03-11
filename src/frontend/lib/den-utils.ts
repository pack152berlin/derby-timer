import lionImg    from '../assets/dens/lion-rank.svg';
import tigerImg   from '../assets/dens/tiger-rank.svg';
import wolfImg    from '../assets/dens/wolf-rank.svg';
import bearImg    from '../assets/dens/bear-rank.svg';
import webelosImg from '../assets/dens/webelos-rank.svg';
import aolImg     from '../assets/dens/aol-rank.svg';

export const DEN_IMAGES: Record<string, string> = {
  'Lions':   lionImg,
  'Tigers':  tigerImg,
  'Wolves':  wolfImg,
  'Bears':   bearImg,
  'Webelos': webelosImg,
  'AOLs':    aolImg,
};

export const DEN_SINGULAR: Record<string, string> = {
  Lions: 'Lion', Tigers: 'Tiger', Wolves: 'Wolf',
  Bears: 'Bear', Webelos: 'Webelos', AOLs: 'AOL',
};

export const DEN_ACCENT: Record<string, string> = {
  Lions: '#eab308', Tigers: '#ea580c', Wolves: '#2563eb',
  Bears: '#dc2626', Webelos: '#4f46e5', AOLs: '#059669',
};
