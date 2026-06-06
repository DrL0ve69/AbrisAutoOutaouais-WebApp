import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/layout/navbar/navbar';
import { FooterComponent } from './shared/layout/footer/footer';
import { SkipNavComponent } from './shared/layout/skip-nav/skip-nav';

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, SkipNavComponent],
})
export class AppComponent { }
