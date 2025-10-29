import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// ngx-translate
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { Observable } from 'rxjs';

// Simple asset-based translate loader (avoids DI token requirements)
class AssetTranslateLoader implements TranslateLoader {
  constructor(private http: HttpClient) {}

  getTranslation(lang: string): Observable<any> {
    return this.http.get(`./assets/i18n/${lang}.json`);
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
