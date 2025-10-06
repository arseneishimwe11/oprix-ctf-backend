# Oprix CTF Platform - Makefile
# Quick commands for common operations

.PHONY: help install dev build start stop restart logs clean backup restore health deploy

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)Oprix CTF Platform - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "$(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

install: ## Install dependencies
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	npm install
	npx prisma generate

dev: ## Start development server
	@echo "$(YELLOW)Starting development server...$(NC)"
	npm run start:dev

build: ## Build application
	@echo "$(YELLOW)Building application...$(NC)"
	npm run build

# Docker Commands
up: ## Start all services (docker-compose up)
	@echo "$(YELLOW)Starting services...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Services started$(NC)"

down: ## Stop all services (docker-compose down)
	@echo "$(YELLOW)Stopping services...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ Services stopped$(NC)"

start: ## Start services
	@echo "$(YELLOW)Starting services...$(NC)"
	docker-compose start

stop: ## Stop services
	@echo "$(YELLOW)Stopping services...$(NC)"
	docker-compose stop

restart: ## Restart services
	@echo "$(YELLOW)Restarting services...$(NC)"
	docker-compose restart
	@echo "$(GREEN)✓ Services restarted$(NC)"

logs: ## View logs (use 'make logs service=backend' for specific service)
	@if [ -z "$(service)" ]; then \
		docker-compose logs -f; \
	else \
		docker-compose logs -f $(service); \
	fi

ps: ## Show running services
	docker-compose ps

# Database Commands
db-migrate: ## Run database migrations
	@echo "$(YELLOW)Running migrations...$(NC)"
	npx prisma migrate deploy
	@echo "$(GREEN)✓ Migrations complete$(NC)"

db-seed: ## Seed database with SuperAdmin
	@echo "$(YELLOW)Seeding database...$(NC)"
	npm run prisma:seed
	@echo "$(GREEN)✓ Database seeded$(NC)"

db-reset: ## Reset database (WARNING: DATA LOSS)
	@echo "$(YELLOW)Resetting database...$(NC)"
	npx prisma migrate reset --force
	@echo "$(GREEN)✓ Database reset$(NC)"

db-studio: ## Open Prisma Studio
	npx prisma studio

# Backup & Restore
backup: ## Create database backup
	@echo "$(YELLOW)Creating backup...$(NC)"
	./scripts/backup.sh

restore: ## Restore database (use 'make restore file=backup.sql.gz')
	@if [ -z "$(file)" ]; then \
		echo "$(YELLOW)Usage: make restore file=backups/db_backup_XXXXXXXX.sql.gz$(NC)"; \
		ls -lh backups/*.gz 2>/dev/null || echo "No backups found"; \
	else \
		./scripts/restore.sh $(file); \
	fi

# Health & Monitoring
health: ## Check platform health
	@./scripts/health-check.sh

stats: ## Show container stats
	docker stats --no-stream

# Deployment
deploy: ## Deploy to production
	@echo "$(BLUE)=== Production Deployment ===$(NC)"
	./scripts/deploy.sh

deploy-prod: ## Deploy with production overrides
	@echo "$(YELLOW)Deploying with production configuration...$(NC)"
	docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
	@echo "$(GREEN)✓ Production deployment complete$(NC)"

# Scaling
scale: ## Scale backend (use 'make scale replicas=3')
	@if [ -z "$(replicas)" ]; then \
		echo "$(YELLOW)Usage: make scale replicas=3$(NC)"; \
	else \
		docker-compose up -d --scale backend=$(replicas); \
		echo "$(GREEN)✓ Scaled backend to $(replicas) replicas$(NC)"; \
	fi

# Maintenance
clean: ## Clean up Docker resources
	@echo "$(YELLOW)Cleaning up...$(NC)"
	docker-compose down -v
	docker system prune -f
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

update: ## Update platform to latest version
	@echo "$(YELLOW)Updating platform...$(NC)"
	git pull origin main
	npm install
	npx prisma generate
	docker-compose build
	docker-compose up -d
	@echo "$(GREEN)✓ Update complete$(NC)"

rebuild: ## Rebuild and restart services
	@echo "$(YELLOW)Rebuilding services...$(NC)"
	docker-compose down
	docker-compose build --no-cache
	docker-compose up -d
	@echo "$(GREEN)✓ Rebuild complete$(NC)"

# Testing
test: ## Run tests
	npm run test

test-e2e: ## Run end-to-end tests
	npm run test:e2e

# Security
security-scan: ## Scan for vulnerabilities
	npm audit
	docker scan oprix-ctf-backend:latest || true

# Quick Commands
quick-start: ## Quick start for development
	@echo "$(BLUE)=== Quick Start ===$(NC)"
	npm install
	docker-compose up -d postgres redis
	sleep 5
	npx prisma migrate deploy
	npx prisma generate
	npm run prisma:seed
	npm run start:dev

production-start: install db-migrate db-seed deploy ## Complete production setup

.DEFAULT_GOAL := help
