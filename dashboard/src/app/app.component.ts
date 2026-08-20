import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DataService } from './core/services/data.service';
import { FiltroEscopoService } from './core/services/filtro-escopo.service';
import { CarregarComponent } from './features/carregar/carregar.component';
import { TopbarComponent } from './layout/topbar.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CarregarComponent, TopbarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  readonly dados = inject(DataService);
  readonly escopo = inject(FiltroEscopoService);
}
