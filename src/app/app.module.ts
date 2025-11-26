import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// ngx-translate
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { Observable } from 'rxjs';

// Ermittelt die Base-URL der Web Component Scripts für Cross-Origin Einbindung
function getComponentBaseUrl(): string {
  const scripts = document.querySelectorAll('script[src*="main"]');
  for (const script of Array.from(scripts)) {
    const src = script.getAttribute('src');
    if (src && (src.includes('main.js') || src.includes('main.') && src.endsWith('.js'))) {
      const lastSlash = src.lastIndexOf('/');
      if (lastSlash > 0) {
        return src.substring(0, lastSlash + 1);
      }
    }
  }
  return './'; // Fallback für Same-Origin
}

// Translate loader mit dynamischer Base-URL für Cross-Origin Web Component
class AssetTranslateLoader implements TranslateLoader {
  private baseUrl: string;
  
  constructor(private http: HttpClient) {
    this.baseUrl = getComponentBaseUrl();
  }

  getTranslation(lang: string): Observable<any> {
    const url = `${this.baseUrl}assets/i18n/${lang}.json`;
    console.log(`🌐 Loading i18n: ${url}`);
    return this.http.get(url);
  }
}

export function HttpLoaderFactory(http: HttpClient): TranslateLoader {
  return new AssetTranslateLoader(http);
}

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { TextFieldModule } from '@angular/cdk/text-field';

// Components
import { AppComponent } from './app.component';
import { CanvasViewComponent } from './components/canvas-view/canvas-view.component';

// Services
import { SchemaLoaderService } from './services/schema-loader.service';
import { CanvasService } from './services/canvas.service';
import { FieldExtractionWorkerPoolService } from './services/field-extraction-worker-pool.service';
import { FieldNormalizerService } from './services/field-normalizer.service';

//Edu-Sharing
import { BApiModule } from 'ngx-edu-sharing-b-api';



@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatRadioModule,
    MatSelectModule,
    MatAutocompleteModule,
    MatCardModule,
    MatProgressBarModule,
    TextFieldModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      }
    }),
    CanvasViewComponent, // Standalone component
    BApiModule.forRoot({ rootUrl: 'https://repository.staging.openeduhub.net/edu-sharing/rest/bapi' }),
  ],
  providers: [
    SchemaLoaderService,
    CanvasService,
    FieldExtractionWorkerPoolService,
    FieldNormalizerService
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
