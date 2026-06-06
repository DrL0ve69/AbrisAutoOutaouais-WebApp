import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule],
  templateUrl: './home.html',
  styles: [`
    .home-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background-color: #f8f9fa;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    .navbar {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 1rem 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    .navbar-brand h2 {
      margin: 0;
      font-size: 24px;
    }

    .navbar-nav {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .user-menu {
      display: flex;
      gap: 1rem;
      align-items: center;
    }

    .user-name {
      font-weight: 500;
    }

    .logout-btn {
      background-color: rgba(255, 255, 255, 0.2);
      color: white;
      border: 1px solid white;
      padding: 0.5rem 1rem;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.3s;
    }

    .logout-btn:hover {
      background-color: rgba(255, 255, 255, 0.3);
    }

    .main-content {
      flex: 1;
      padding: 2rem;
      max-width: 1200px;
      margin: 0 auto;
      width: 100%;
    }

    .hero {
      text-align: center;
      margin-bottom: 3rem;
      padding: 2rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
    }

    .hero h1 {
      font-size: 36px;
      margin-bottom: 1rem;
      color: #333;
    }

    .hero p {
      font-size: 18px;
      color: #666;
    }

    .services {
      margin-bottom: 3rem;
    }

    .services h2 {
      font-size: 28px;
      margin-bottom: 2rem;
      color: #333;
      text-align: center;
    }

    .service-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
    }

    .service-card {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      text-align: center;
      transition: transform 0.3s, box-shadow 0.3s;
    }

    .service-card:hover {
      transform: translateY(-5px);
      box-shadow: 0 5px 20px rgba(0, 0, 0, 0.1);
    }

    .service-icon {
      font-size: 48px;
      margin-bottom: 1rem;
    }

    .service-card h3 {
      font-size: 20px;
      margin-bottom: 0.5rem;
      color: #333;
    }

    .service-card p {
      color: #666;
      margin-bottom: 1.5rem;
    }

    .btn-primary {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 4px;
      cursor: pointer;
      transition: transform 0.2s, box-shadow 0.2s;
      border: none;
      font-size: 14px;
      font-weight: 600;
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
    }

    .btn-secondary {
      display: inline-block;
      padding: 0.75rem 1.5rem;
      background: white;
      color: #667eea;
      border: 2px solid #667eea;
      text-decoration: none;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.3s;
      font-size: 14px;
      font-weight: 600;
    }

    .btn-secondary:hover {
      background: #667eea;
      color: white;
    }

    .user-info {
      background: white;
      padding: 2rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      margin-bottom: 2rem;
    }

    .user-info h3 {
      color: #333;
      margin-bottom: 1rem;
    }

    .info-card {
      background: #f8f9fa;
      padding: 1.5rem;
      border-radius: 4px;
    }

    .info-card p {
      color: #666;
      margin: 0.5rem 0;
    }

    .welcome-message {
      display: flex;
      justify-content: center;
      align-items: center;
      flex: 1;
    }

    .welcome-card {
      background: white;
      padding: 3rem;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
      text-align: center;
      max-width: 500px;
    }

    .welcome-card h3 {
      font-size: 28px;
      margin-bottom: 1rem;
      color: #333;
    }

    .welcome-card p {
      color: #666;
      margin-bottom: 2rem;
    }

    .button-group {
      display: flex;
      gap: 1rem;
      justify-content: center;
    }

    @media (max-width: 768px) {
      .main-content {
        padding: 1rem;
      }

      .hero h1 {
        font-size: 24px;
      }

      .service-grid {
        grid-template-columns: 1fr;
      }

      .button-group {
        flex-direction: column;
      }
    }
  `]
})
export class HomeComponent {
  constructor(public authService: AuthService) {}

  onLogout() {
    this.authService.logout();
  }
}
