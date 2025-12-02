import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-root',
  standalone: false,
  template: `
    <div class="app-container">
      <app-canvas-view></app-canvas-view>
    </div>
  `,
  styles: [`
    .app-container {
      width: 100%;
      height: 100vh;
      display: flex;
      flex-direction: column;
      background: #f5f7fa;
    }
  `]
})
export class AppComponent implements OnInit {
  title = 'Metadata Agent - Canvas Edition';
  
  constructor() {
  }
  
  ngOnInit() {
    // Erkenne Theme aus URL-Parameter
    const params = new URLSearchParams(window.location.search);
    const theme = params.get('theme');
    
    if (theme === 'edu-sharing') {
      this.loadEduSharingTheme();
    }
    // Note: contextName URL parameter is handled by CanvasViewComponent
  }
  
  private loadEduSharingTheme() {
    document.body.classList.add('edu-theme');
    
    // Lade Theme-CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'assets/themes/edu-sharing-theme.css';
    document.head.appendChild(link);
    
    }
}
