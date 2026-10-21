// ==========================================================================
// GameStreamer Vector Icons (Matching BroadcastIcon.png & Design System)
// ==========================================================================

export const BROADCAST_ICON_SVG = `
  <svg class="broadcast-icon-svg" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle;">
    <!-- Center Antenna Tower (Circle Head + Tapered Flared Body) -->
    <path d="M12 6.5C13.55 6.5 14.8 7.75 14.8 9.3C14.8 10.4 14.15 11.35 13.2 11.8L14.7 19.3C14.85 20.05 14.25 20.7 13.5 20.7H10.5C9.75 20.7 9.15 20.05 9.3 19.3L10.8 11.8C9.85 11.35 9.2 10.4 9.2 9.3C9.2 7.75 10.45 6.5 12 6.5Z" fill="currentColor"/>
    
    <!-- Inner Concentric Waves (Left & Right) -->
    <path d="M7.8 5.6C5.9 7.6 5.9 10.9 7.8 12.9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M16.2 5.6C18.1 7.6 18.1 10.9 16.2 12.9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
    
    <!-- Outer Concentric Waves (Left & Right) -->
    <path d="M4.9 2.7C1.5 6.2 1.5 12.3 4.9 15.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M19.1 2.7C22.5 6.2 22.5 12.3 19.1 15.8" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
  </svg>
`;

export function getBroadcastIcon(size = 18, color = 'currentColor', extraClass = '') {
  return `
    <svg class="broadcast-icon-svg ${extraClass}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: inline-block; vertical-align: middle; flex-shrink: 0;">
      <!-- Center Antenna Tower (Circle Head + Tapered Flared Body) -->
      <path d="M12 6.5C13.55 6.5 14.8 7.75 14.8 9.3C14.8 10.4 14.15 11.35 13.2 11.8L14.7 19.3C14.85 20.05 14.25 20.7 13.5 20.7H10.5C9.75 20.7 9.15 20.05 9.3 19.3L10.8 11.8C9.85 11.35 9.2 10.4 9.2 9.3C9.2 7.75 10.45 6.5 12 6.5Z" fill="${color}"/>
      
      <!-- Inner Concentric Waves (Left & Right) -->
      <path d="M7.8 5.6C5.9 7.6 5.9 10.9 7.8 12.9" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M16.2 5.6C18.1 7.6 18.1 10.9 16.2 12.9" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
      
      <!-- Outer Concentric Waves (Left & Right) -->
      <path d="M4.9 2.7C1.5 6.2 1.5 12.3 4.9 15.8" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M19.1 2.7C22.5 6.2 22.5 12.3 19.1 15.8" stroke="${color}" stroke-width="2.4" stroke-linecap="round"/>
    </svg>
  `;
}
