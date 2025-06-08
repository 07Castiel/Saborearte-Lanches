// ===== SABOREARTE LANCHES - SISTEMA DE GESTÃO =====
// Estado Global da Aplicação
const AppState = {
    produtos: [],
    pedidos: [],
    estoque: {},
    clientes: [],
    configuracoes: {
        nome: 'SABOREARTE Lanches',
        telefone: '(88) 99293-2350',
        endereco: 'Sobral - CE',
        email: 'jadercuris@gmail.com',
        taxaDelivery: 5.00,
        tempoDelivery: 45,
        raioDelivery: 5,
        minimoDelivery: 15.00,
        estoqueMinimo: 10,
        alertaEstoque: true,
        tema: 'light',
        somNotificacao: true,
        backupAuto: true
    },
    pedidoAtual: {
        itens: [],
        total: 0,
        subtotal: 0,
        taxaEntrega: 0
    },
    filtros: {
        produtos: { categoria: '', status: '', busca: '' },
        pedidos: { status: '', tipo: '', data: '' },
        estoque: { status: '', busca: '' },
        delivery: { status: '', periodo: 'hoje' }
    },
    ui: {
        sidebarCollapsed: false,
        somAtivo: true,
        notificacoesAtivas: true
    }
};

// Utilitários
const Utils = {
    // Formatação de moeda
    formatCurrency: (value) => {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(value);
    },

    // Formatação de data
    formatDate: (date, options = {}) => {
        const defaultOptions = {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        };
        return new Date(date).toLocaleDateString('pt-BR', { ...defaultOptions, ...options });
    },

    // Formatação de tempo relativo
    formatTimeAgo: (date) => {
        const now = new Date();
        const diff = Math.floor((now - new Date(date)) / 60000); // minutos
        
        if (diff < 1) return 'Agora';
        if (diff < 60) return `${diff} min atrás`;
        if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
        return `${Math.floor(diff / 1440)} dias atrás`;
    },

    // Geração de ID único
    generateId: () => {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },

    // Debounce para otimizar buscas
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Validação de email
    isValidEmail: (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    },

    // Validação de telefone
    isValidPhone: (phone) => {
        const re = /^\(\d{2}\)\s\d{4,5}-\d{4}$/;
        return re.test(phone);
    },

    // Máscara de telefone
    phoneMask: (value) => {
        return value
            .replace(/\D/g, '')
            .replace(/(\d{2})(\d)/, '($1) $2')
            .replace(/(\d{4})(\d)/, '$1-$2')
            .replace(/(\d{4})-(\d)(\d{4})/, '$1$2-$3')
            .replace(/(-\d{4})\d+?$/, '$1');
    },

    // Calcular distância entre coordenadas (aproximada)
    calculateDistance: (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Raio da Terra em km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
};

// Sistema de Notificações
const NotificationSystem = {
    show: (message, type = 'info', duration = 3000) => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${NotificationSystem.getIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close" onclick="NotificationSystem.close(this.parentElement)">
                <i class="fas fa-times"></i>
            </button>
        `;

        const container = document.getElementById('toast-container');
        container.appendChild(toast);

        // Som de notificação
        if (AppState.configuracoes.somNotificacao && type !== 'info') {
            NotificationSystem.playSound();
        }

        // Auto-remover
        setTimeout(() => {
            NotificationSystem.close(toast);
        }, duration);

        return toast;
    },

    close: (toast) => {
        if (toast && toast.parentElement) {
            toast.style.animation = 'toastSlideOut 0.3s ease-out';
            setTimeout(() => {
                if (toast.parentElement) {
                    toast.parentElement.removeChild(toast);
                }
            }, 300);
        }
    },

    getIcon: (type) => {
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        return icons[type] || 'info-circle';
    },

    playSound: () => {
        if (AppState.ui.somAtivo) {
            const audio = document.getElementById('notification-sound');
            if (audio) {
                audio.currentTime = 0;
                audio.play().catch(() => {
                    // Ignorar erro se o usuário não interagiu ainda
                });
            }
        }
    }
};

// Sistema de Armazenamento
const Storage = {
    save: () => {
        try {
            localStorage.setItem('saborearte_produtos', JSON.stringify(AppState.produtos));
            localStorage.setItem('saborearte_pedidos', JSON.stringify(AppState.pedidos));
            localStorage.setItem('saborearte_estoque', JSON.stringify(AppState.estoque));
            localStorage.setItem('saborearte_clientes', JSON.stringify(AppState.clientes));
            localStorage.setItem('saborearte_configuracoes', JSON.stringify(AppState.configuracoes));
            
            if (AppState.configuracoes.backupAuto) {
                Storage.createBackup();
            }
        } catch (error) {
            console.error('Erro ao salvar dados:', error);
            NotificationSystem.show('Erro ao salvar dados', 'error');
        }
    },

    load: () => {
        try {
            const produtos = localStorage.getItem('saborearte_produtos');
            const pedidos = localStorage.getItem('saborearte_pedidos');
            const estoque = localStorage.getItem('saborearte_estoque');
            const clientes = localStorage.getItem('saborearte_clientes');
            const configuracoes = localStorage.getItem('saborearte_configuracoes');

            if (produtos) AppState.produtos = JSON.parse(produtos);
            if (pedidos) AppState.pedidos = JSON.parse(pedidos);
            if (estoque) AppState.estoque = JSON.parse(estoque);
            if (clientes) AppState.clientes = JSON.parse(clientes);
            if (configuracoes) {
                AppState.configuracoes = { ...AppState.configuracoes, ...JSON.parse(configuracoes) };
            }
        } catch (error) {
            console.error('Erro ao carregar dados:', error);
            NotificationSystem.show('Erro ao carregar dados', 'error');
        }
    },

    createBackup: () => {
        const backup = {
            timestamp: new Date().toISOString(),
            data: {
                produtos: AppState.produtos,
                pedidos: AppState.pedidos,
                estoque: AppState.estoque,
                clientes: AppState.clientes,
                configuracoes: AppState.configuracoes
            }
        };
        
        const backupKey = `saborearte_backup_${new Date().toISOString().split('T')[0]}`;
        localStorage.setItem(backupKey, JSON.stringify(backup));
        
        // Manter apenas os últimos 7 backups
        Storage.cleanOldBackups();
    },

    cleanOldBackups: () => {
        const keys = Object.keys(localStorage).filter(key => key.startsWith('saborearte_backup_'));
        if (keys.length > 7) {
            keys.sort().slice(0, keys.length - 7).forEach(key => {
                localStorage.removeItem(key);
            });
        }
    },

    exportData: () => {
        const data = {
            produtos: AppState.produtos,
            pedidos: AppState.pedidos,
            estoque: AppState.estoque,
            clientes: AppState.clientes,
            configuracoes: AppState.configuracoes,
            exportDate: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `saborearte_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};

// Inicialização do Sistema
document.addEventListener('DOMContentLoaded', function() {
    SystemInit.initialize();
});

const SystemInit = {
    initialize: () => {
        console.log('🍔 Inicializando SABOREARTE Sistema de Gestão...');
        
        // Carregar dados salvos
        Storage.load();
        
        // Inicializar produtos padrão se necessário
        if (AppState.produtos.length === 0) {
            SystemInit.loadDefaultProducts();
        }
        
        // Configurar event listeners
        SystemInit.setupEventListeners();
        
        // Atualizar interface
        SystemInit.updateInterface();
        
        // Iniciar relógio
        SystemInit.startClock();
        
        // Configurar auto-save
        SystemInit.setupAutoSave();
        
        console.log('✅ Sistema inicializado com sucesso!');
        NotificationSystem.show('Sistema carregado com sucesso!', 'success');
    },

    loadDefaultProducts: () => {
        const defaultProducts = [
            { id: 1, nome: 'X-Burger Clássico', categoria: 'lanches', preco: 15.00, tempo: 15, descricao: 'Hambúrguer, queijo, alface e tomate', ativo: true, destaque: false },
            { id: 2, nome: 'X-Bacon Especial', categoria: 'lanches', preco: 18.00, tempo: 18, descricao: 'Hambúrguer, queijo, bacon, alface e tomate', ativo: true, destaque: true },
            { id: 3, nome: 'X-Tudo Supremo', categoria: 'lanches', preco: 22.00, tempo: 20, descricao: 'Hambúrguer, queijo, bacon, ovo, presunto, alface e tomate', ativo: true, destaque: true },
            { id: 4, nome: 'Coca-Cola Lata', categoria: 'bebidas', preco: 5.00, tempo: 2, descricao: '350ml gelada', ativo: true, destaque: false },
            { id: 5, nome: 'Guaraná Antarctica', categoria: 'bebidas', preco: 4.50, tempo: 2, descricao: '350ml gelado', ativo: true, destaque: false },
            { id: 6, nome: 'Água Mineral', categoria: 'bebidas', preco: 3.00, tempo: 1, descricao: '500ml', ativo: true, destaque: false },
            { id: 7, nome: 'Batata Frita Pequena', categoria: 'porcoes', preco: 10.00, tempo: 12, descricao: 'Porção individual', ativo: true, destaque: false },
            { id: 8, nome: 'Batata Frita Grande', categoria: 'porcoes', preco: 18.00, tempo: 15, descricao: 'Porção para compartilhar', ativo: true, destaque: false },
            { id: 9, nome: 'Pudim Caseiro', categoria: 'sobremesas', preco: 8.00, tempo: 3, descricao: 'Fatia generosa', ativo: true, destaque: false },
            { id: 10, nome: 'Brownie com Sorvete', categoria: 'sobremesas', preco: 12.00, tempo: 5, descricao: 'Brownie quente com sorvete de baunilha', ativo: true, destaque: true }
        ];

        AppState.produtos = defaultProducts;
        
        // Inicializar estoque
        defaultProducts.forEach(produto => {
            AppState.estoque[produto.id] = {
                quantidade: 50,
                minimo: AppState.configuracoes.estoqueMinimo,
                ultimaMovimentacao: new Date(),
                movimentacoes: []
            };
        });
        
        Storage.save();
    },

    setupEventListeners: () => {
        // Navegação
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const section = link.getAttribute('data-section');
                if (section) {
                    Navigation.showSection(section);
                }
            });
        });

        // Formulários
        const formPedido = document.getElementById('form-pedido');
        if (formPedido) {
            formPedido.addEventListener('submit', OrderManager.finalizarPedido);
        }

        const formProduto = document.getElementById('form-produto');
        if (formProduto) {
            formProduto.addEventListener('submit', ProductManager.salvarProduto);
        }

        const formEstoque = document.getElementById('form-estoque');
        if (formEstoque) {
            formEstoque.addEventListener('submit', StockManager.registrarMovimentacao);
        }

        // Tipo de pedido
        const tipoPedido = document.getElementById('tipo-pedido');
        if (tipoPedido) {
            tipoPedido.addEventListener('change', OrderManager.toggleDeliveryInfo);
        }

        // Busca de produtos
        const buscaProdutos = document.getElementById('busca-produtos');
        if (buscaProdutos) {
            buscaProdutos.addEventListener('input', Utils.debounce(ProductManager.filtrarProdutos, 300));
        }

        // Busca no estoque
        const buscaEstoque = document.getElementById('busca-estoque');
        if (buscaEstoque) {
            buscaEstoque.addEventListener('input', Utils.debounce(StockManager.filtrarEstoque, 300));
        }

        // Filtros
        SystemInit.setupFilters();

        // Sidebar toggle
        const sidebarToggle = document.querySelector('.sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', UI.toggleSidebar);
        }

        // Atalhos de teclado
        document.addEventListener('keydown', SystemInit.handleKeyboardShortcuts);
    },

    setupFilters: () => {
        // Filtros de produtos
        const filtroCategoria = document.getElementById('filtro-categoria');
        if (filtroCategoria) {
            filtroCategoria.addEventListener('change', ProductManager.filtrarProdutos);
        }

        const filtroStatusProduto = document.getElementById('filtro-status-produto');
        if (filtroStatusProduto) {
            filtroStatusProduto.addEventListener('change', ProductManager.filtrarProdutos);
        }

        // Filtros de pedidos
        const filtroStatusPedido = document.getElementById('filtro-status');
        if (filtroStatusPedido) {
            filtroStatusPedido.addEventListener('change', OrderManager.filtrarPedidos);
        }

        const filtroTipoPedido = document.getElementById('filtro-tipo');
        if (filtroTipoPedido) {
            filtroTipoPedido.addEventListener('change', OrderManager.filtrarPedidos);
        }

        // Filtros de estoque
        const filtroStatusEstoque = document.getElementById('filtro-status-estoque');
        if (filtroStatusEstoque) {
            filtroStatusEstoque.addEventListener('change', StockManager.filtrarEstoque);
        }

        // Filtros de delivery
        const filtroStatusDelivery = document.getElementById('filtro-status-delivery');
        if (filtroStatusDelivery) {
            filtroStatusDelivery.addEventListener('change', DeliveryManager.filtrarDeliveries);
        }

        const filtroPeriodoDelivery = document.getElementById('filtro-periodo-delivery');
        if (filtroPeriodoDelivery) {
            filtroPeriodoDelivery.addEventListener('change', DeliveryManager.filtrarDeliveries);
        }
    },

    handleKeyboardShortcuts: (e) => {
        // Ctrl/Cmd + teclas
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case 'n':
                    e.preventDefault();
                    Navigation.showSection('pedidos');
                    document.getElementById('cliente-nome')?.focus();
                    break;
                case 'p':
                    e.preventDefault();
                    Navigation.showSection('produtos');
                    break;
                case 'e':
                    e.preventDefault();
                    Navigation.showSection('estoque');
                    break;
                case 'd':
                    e.preventDefault();
                    Navigation.showSection('delivery');
                    break;
                case 'k':
                    e.preventDefault();
                    Navigation.showSection('cozinha');
                    break;
                case 's':
                    e.preventDefault();
                    Storage.save();
                    NotificationSystem.show('Dados salvos!', 'success');
                    break;
            }
        }

        // Tecla ESC
        if (e.key === 'Escape') {
            UI.closeAllModals();
        }
    },

    updateInterface: () => {
        Dashboard.atualizar();
        ProductManager.atualizarLista();
        ProductManager.atualizarSelects();
        StockManager.atualizarLista();
        OrderManager.atualizarProximoNumero();
    },

    startClock: () => {
        const updateDateTime = () => {
            const now = new Date();
            const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            };
            const dateTimeElement = document.getElementById('datetime');
            if (dateTimeElement) {
                dateTimeElement.textContent = now.toLocaleDateString('pt-BR', options);
            }
        };

        updateDateTime();
        setInterval(updateDateTime, 1000);
    },

    setupAutoSave: () => {
        // Auto-save a cada 30 segundos
        setInterval(() => {
            Storage.save();
        }, 30000);

        // Save antes de fechar a página
        window.addEventListener('beforeunload', () => {
            Storage.save();
        });
    }
};

// Sistema de Navegação
const Navigation = {
    showSection: (sectionId) => {
        // Esconder todas as seções
        document.querySelectorAll('.section').forEach(section => {
            section.classList.remove('active');
        });

        // Mostrar seção selecionada
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Atualizar navegação
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        const activeLink = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }

        // Atualizar título
        const titles = {
            'dashboard': 'Dashboard',
            'pedidos': 'Gestão de Pedidos',
            'cozinha': 'Painel da Cozinha',
            'produtos': 'Gestão de Produtos',
            'estoque': 'Controle de Estoque',
            'delivery': 'Gestão de Delivery',
            'relatorios': 'Relatórios Gerenciais',
            'configuracoes': 'Configurações do Sistema'
        };
        
        const titleElement = document.getElementById('page-title');
        if (titleElement) {
            titleElement.textContent = titles[sectionId] || 'Sistema';
        }

        // Atualizar dados específicos da seção
        Navigation.updateSectionData(sectionId);
    },

    updateSectionData: (sectionId) => {
        switch (sectionId) {
            case 'dashboard':
                Dashboard.atualizar();
                break;
            case 'cozinha':
                KitchenManager.atualizarPainel();
                break;
            case 'delivery':
                DeliveryManager.atualizar();
                break;
            case 'pedidos':
                OrderManager.atualizarLista();
                break;
            case 'produtos':
                ProductManager.atualizarLista();
                break;
            case 'estoque':
                StockManager.atualizarLista();
                break;
            case 'relatorios':
                ReportManager.atualizarRelatorios();
                break;
        }
    }
};

// Gerenciador de Dashboard
const Dashboard = {
    atualizar: () => {
        Dashboard.atualizarEstatisticas();
        Dashboard.atualizarPedidosRecentes();
        Dashboard.atualizarProdutosMaisVendidos();
        Dashboard.atualizarAlertasEstoque();
        Dashboard.atualizarPerformanceCozinha();
    },

    atualizarEstatisticas: () => {
        const hoje = new Date().toDateString();
        const pedidosHoje = AppState.pedidos.filter(p => new Date(p.data).toDateString() === hoje);
        
        // Pedidos hoje
        const pedidosHojeElement = document.getElementById('pedidos-hoje');
        if (pedidosHojeElement) {
            pedidosHojeElement.textContent = pedidosHoje.length;
        }
        
        // Vendas hoje
        const vendasHoje = pedidosHoje.reduce((total, p) => total + p.total, 0);
        const vendasHojeElement = document.getElementById('vendas-hoje');
        if (vendasHojeElement) {
            vendasHojeElement.textContent = Utils.formatCurrency(vendasHoje);
        }
        
        // Pedidos em aberto
        const pedidosAbertos = AppState.pedidos.filter(p => 
            p.status !== 'entregue' && p.status !== 'cancelado'
        ).length;
        const pedidosAbertosElement = document.getElementById('pedidos-abertos');
        if (pedidosAbertosElement) {
            pedidosAbertosElement.textContent = pedidosAbertos;
        }
        
        // Delivery em andamento
        const deliveryAndamento = AppState.pedidos.filter(p => 
            p.tipo === 'delivery' && (p.status === 'pronto' || p.status === 'em_rota')
        ).length;
        const deliveryAndamentoElement = document.getElementById('delivery-andamento');
        if (deliveryAndamentoElement) {
            deliveryAndamentoElement.textContent = deliveryAndamento;
        }

        // Calcular mudanças percentuais (simulado)
        Dashboard.atualizarMudancasPercentuais(pedidosHoje.length, vendasHoje);
    },

    atualizarMudancasPercentuais: (pedidosHoje, vendasHoje) => {
        // Simulação de dados do dia anterior para cálculo de mudança
        const pedidosOntem = Math.floor(pedidosHoje * 0.9); // Simulado
        const vendasOntem = vendasHoje * 0.85; // Simulado

        const mudancaPedidos = pedidosOntem > 0 ? ((pedidosHoje - pedidosOntem) / pedidosOntem * 100) : 0;
        const mudancaVendas = vendasOntem > 0 ? ((vendasHoje - vendasOntem) / vendasOntem * 100) : 0;

        const pedidosChangeElement = document.getElementById('pedidos-change');
        if (pedidosChangeElement) {
            pedidosChangeElement.textContent = `${mudancaPedidos >= 0 ? '+' : ''}${mudancaPedidos.toFixed(1)}%`;
            pedidosChangeElement.className = `stat-change ${mudancaPedidos >= 0 ? 'positive' : 'negative'}`;
        }

        const vendasChangeElement = document.getElementById('vendas-change');
        if (vendasChangeElement) {
            vendasChangeElement.textContent = `${mudancaVendas >= 0 ? '+' : ''}${mudancaVendas.toFixed(1)}%`;
            vendasChangeElement.className = `stat-change ${mudancaVendas >= 0 ? 'positive' : 'negative'}`;
        }
    },

    atualizarPedidosRecentes: () => {
        const container = document.getElementById('pedidos-recentes');
        if (!container) return;

        const pedidosRecentes = AppState.pedidos.slice(-5).reverse();

        if (pedidosRecentes.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <p>Nenhum pedido registrado hoje.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = pedidosRecentes.map(pedido => `
            <div class="pedido-card" onclick="OrderManager.verDetalhes(${pedido.id})">
                <div class="pedido-header">
                    <span class="pedido-numero">${pedido.numero}</span>
                    <span class="pedido-status status-${pedido.status}">${Dashboard.getStatusLabel(pedido.status)}</span>
                </div>
                <p><strong>${pedido.cliente}</strong></p>
                <p>${pedido.itens.length} itens - ${Utils.formatCurrency(pedido.total)}</p>
                <p style="font-size: 0.875rem; color: var(--gray);">
                    ${Utils.formatTimeAgo(pedido.data)}
                </p>
            </div>
        `).join('');
    },

    atualizarProdutosMaisVendidos: () => {
        const container = document.getElementById('produtos-vendidos');
        if (!container) return;

        // Calcular produtos mais vendidos
        const vendas = {};
        AppState.pedidos.forEach(pedido => {
            pedido.itens.forEach(item => {
                if (!vendas[item.id]) {
                    vendas[item.id] = { nome: item.nome, quantidade: 0, valor: 0 };
                }
                vendas[item.id].quantidade += item.quantidade;
                vendas[item.id].valor += item.total;
            });
        });

        const produtosMaisVendidos = Object.values(vendas)
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, 5);

        if (produtosMaisVendidos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-hamburger"></i>
                    <p>Nenhuma venda registrada.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = produtosMaisVendidos.map((produto, index) => `
            <div class="produto-vendido-item">
                <div class="ranking">${index + 1}º</div>
                <div class="produto-info">
                    <div class="produto-nome">${produto.nome}</div>
                    <div class="produto-stats">
                        ${produto.quantidade} vendidos - ${Utils.formatCurrency(produto.valor)}
                    </div>
                </div>
            </div>
        `).join('');
    },

    atualizarAlertasEstoque: () => {
        const container = document.getElementById('alertas-estoque');
        if (!container) return;

        const alertas = [];
        AppState.produtos.forEach(produto => {
            const estoque = AppState.estoque[produto.id];
            if (estoque && estoque.quantidade <= estoque.minimo) {
                alertas.push({
                    produto: produto.nome,
                    quantidade: estoque.quantidade,
                    minimo: estoque.minimo,
                    status: estoque.quantidade === 0 ? 'esgotado' : 'baixo'
                });
            }
        });

        if (alertas.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-boxes"></i>
                    <p>Todos os produtos em estoque adequado.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = alertas.map(alerta => `
            <div class="alerta-estoque ${alerta.status}">
                <div class="alerta-info">
                    <strong>${alerta.produto}</strong>
                    <span>Estoque: ${alerta.quantidade} (Mín: ${alerta.minimo})</span>
                </div>
                <div class="alerta-status">
                    <span class="status-badge ${alerta.status}">
                        ${alerta.status === 'esgotado' ? 'Esgotado' : 'Baixo'}
                    </span>
                </div>
            </div>
        `).join('');
    },

    atualizarPerformanceCozinha: () => {
        const pedidosEmPreparo = AppState.pedidos.filter(p => 
            p.status === 'preparando' || p.status === 'novo'
        );

        // Calcular tempo médio
        let tempoMedio = 0;
        let pedidosAtrasados = 0;

        if (pedidosEmPreparo.length > 0) {
            const tempos = pedidosEmPreparo.map(pedido => {
                const tempo = Math.floor((new Date() - new Date(pedido.data)) / 60000);
                if (tempo > 20) pedidosAtrasados++;
                return tempo;
            });
            tempoMedio = Math.floor(tempos.reduce((a, b) => a + b, 0) / tempos.length);
        }

        const tempoMedioElement = document.getElementById('tempo-medio');
        if (tempoMedioElement) {
            tempoMedioElement.textContent = `${tempoMedio} min`;
        }

        const pedidosAtrasadosElement = document.getElementById('pedidos-atrasados');
        if (pedidosAtrasadosElement) {
            pedidosAtrasadosElement.textContent = pedidosAtrasados;
        }

        // Atualizar indicador de performance
        const performanceElement = document.getElementById('performance-indicator');
        if (performanceElement) {
            let performance = 'good';
            let texto = 'Excelente';

            if (pedidosAtrasados > 0) {
                performance = 'warning';
                texto = 'Atenção';
            }
            if (pedidosAtrasados > 2) {
                performance = 'danger';
                texto = 'Crítico';
            }

            performanceElement.innerHTML = `
                <span class="indicator-dot ${performance}"></span>
                <span>${texto}</span>
            `;
        }
    },

    getStatusLabel: (status) => {
        const labels = {
            'novo': 'Novo',
            'preparando': 'Preparando',
            'pronto': 'Pronto',
            'em_rota': 'Em Rota',
            'entregue': 'Entregue',
            'cancelado': 'Cancelado'
        };
        return labels[status] || status;
    }
};

// Gerenciador de Produtos
const ProductManager = {
    toggleForm: () => {
        const container = document.getElementById('form-produto-container');
        const isVisible = container.style.display !== 'none';
        
        if (isVisible) {
            container.style.display = 'none';
            ProductManager.limparForm();
        } else {
            container.style.display = 'block';
            document.getElementById('produto-nome')?.focus();
        }
    },

    salvarProduto: (e) => {
        e.preventDefault();
        
        const id = document.getElementById('produto-id').value;
        const produto = {
            id: id ? parseInt(id) : AppState.produtos.length + 1,
            nome: document.getElementById('produto-nome').value,
            categoria: document.getElementById('produto-categoria').value,
            preco: parseFloat(document.getElementById('produto-preco').value),
            tempo: parseInt(document.getElementById('produto-tempo').value) || 15,
            descricao: document.getElementById('produto-descricao').value,
            ativo: document.getElementById('produto-ativo').checked,
            destaque: document.getElementById('produto-destaque').checked
        };

        if (id) {
            // Editar produto existente
            const index = AppState.produtos.findIndex(p => p.id === parseInt(id));
            if (index !== -1) {
                AppState.produtos[index] = produto;
                NotificationSystem.show('Produto atualizado com sucesso!', 'success');
            }
        } else {
            // Novo produto
            AppState.produtos.push(produto);
            
            // Inicializar estoque
            AppState.estoque[produto.id] = {
                quantidade: 0,
                minimo: AppState.configuracoes.estoqueMinimo,
                ultimaMovimentacao: new Date(),
                movimentacoes: []
            };
            
            NotificationSystem.show('Produto cadastrado com sucesso!', 'success');
        }

        Storage.save();
        ProductManager.atualizarLista();
        ProductManager.atualizarSelects();
        ProductManager.toggleForm();
    },

    editarProduto: (id) => {
        const produto = AppState.produtos.find(p => p.id === id);
        if (!produto) return;

        document.getElementById('produto-id').value = produto.id;
        document.getElementById('produto-nome').value = produto.nome;
        document.getElementById('produto-categoria').value = produto.categoria;
        document.getElementById('produto-preco').value = produto.preco;
        document.getElementById('produto-tempo').value = produto.tempo || 15;
        document.getElementById('produto-descricao').value = produto.descricao || '';
        document.getElementById('produto-ativo').checked = produto.ativo;
        document.getElementById('produto-destaque').checked = produto.destaque || false;

        document.getElementById('form-produto-title').textContent = 'Editar Produto';
        ProductManager.toggleForm();
    },

    removerProduto: (id) => {
        if (!confirm('Deseja realmente remover este produto?')) return;

        AppState.produtos = AppState.produtos.filter(p => p.id !== id);
        delete AppState.estoque[id];
        
        Storage.save();
        ProductManager.atualizarLista();
        ProductManager.atualizarSelects();
        NotificationSystem.show('Produto removido!', 'warning');
    },

    toggleStatus: (id) => {
        const produto = AppState.produtos.find(p => p.id === id);
        if (produto) {
            produto.ativo = !produto.ativo;
            Storage.save();
            ProductManager.atualizarLista();
            NotificationSystem.show(
                `Produto ${produto.ativo ? 'ativado' : 'desativado'}!`, 
                'info'
            );
        }
    },

    atualizarLista: () => {
        const tbody = document.getElementById('lista-produtos');
        if (!tbody) return;

        const produtosFiltrados = ProductManager.aplicarFiltros();

        if (produtosFiltrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-hamburger"></i>
                        <p>Nenhum produto encontrado.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = produtosFiltrados.map(produto => `
            <tr class="${!produto.ativo ? 'produto-inativo' : ''}">
                <td>#${produto.id}</td>
                <td>
                    <div class="produto-info">
                        <strong>${produto.nome}</strong>
                        ${produto.destaque ? '<span class="badge-destaque">⭐ Destaque</span>' : ''}
                        ${produto.descricao ? `<small>${produto.descricao}</small>` : ''}
                    </div>
                </td>
                <td>
                    <span class="categoria-badge categoria-${produto.categoria}">
                        ${ProductManager.getCategoriaIcon(produto.categoria)} ${ProductManager.getCategoriaLabel(produto.categoria)}
                    </span>
                </td>
                <td><strong>${Utils.formatCurrency(produto.preco)}</strong></td>
                <td>${produto.tempo || 15} min</td>
                <td>
                    <span class="status-badge ${produto.ativo ? 'ativo' : 'inativo'}">
                        ${produto.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-action edit" onclick="ProductManager.editarProduto(${produto.id})" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn-action toggle" onclick="ProductManager.toggleStatus(${produto.id})" title="${produto.ativo ? 'Desativar' : 'Ativar'}">
                            <i class="fas fa-${produto.ativo ? 'eye-slash' : 'eye'}"></i>
                        </button>
                        <button class="btn-action delete" onclick="ProductManager.removerProduto(${produto.id})" title="Remover">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    },

    atualizarSelects: () => {
        const selects = ['produto-select', 'estoque-produto'];
        
        selects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (select) {
                const produtosAtivos = AppState.produtos.filter(p => p.ativo);
                select.innerHTML = '<option value="">Selecione um produto</option>' +
                    produtosAtivos.map(produto => 
                        `<option value="${produto.id}">${produto.nome} - ${Utils.formatCurrency(produto.preco)}</option>`
                    ).join('');
            }
        });
    },

    aplicarFiltros: () => {
        let produtos = [...AppState.produtos];

        // Filtro por categoria
        if (AppState.filtros.produtos.categoria) {
            produtos = produtos.filter(p => p.categoria === AppState.filtros.produtos.categoria);
        }

        // Filtro por status
        if (AppState.filtros.produtos.status) {
            const ativo = AppState.filtros.produtos.status === 'ativo';
            produtos = produtos.filter(p => p.ativo === ativo);
        }

        // Filtro por busca
        if (AppState.filtros.produtos.busca) {
            const busca = AppState.filtros.produtos.busca.toLowerCase();
            produtos = produtos.filter(p => 
                p.nome.toLowerCase().includes(busca) ||
                p.descricao?.toLowerCase().includes(busca)
            );
        }

        return produtos;
    },

    filtrarProdutos: () => {
        const busca = document.getElementById('busca-produtos')?.value || '';
        const categoria = document.getElementById('filtro-categoria')?.value || '';
        const status = document.getElementById('filtro-status-produto')?.value || '';

        AppState.filtros.produtos = { busca, categoria, status };
        ProductManager.atualizarLista();
    },

    getCategoriaIcon: (categoria) => {
        const icons = {
            'lanches': '🍔',
            'bebidas': '🥤',
            'porcoes': '🍟',
            'sobremesas': '🍰',
            'combos': '🍽️'
        };
        return icons[categoria] || '🍽️';
    },

    getCategoriaLabel: (categoria) => {
        const labels = {
            'lanches': 'Lanches',
            'bebidas': 'Bebidas',
            'porcoes': 'Porções',
            'sobremesas': 'Sobremesas',
            'combos': 'Combos'
        };
        return labels[categoria] || categoria;
    },

    limparForm: () => {
        document.getElementById('form-produto').reset();
        document.getElementById('produto-id').value = '';
        document.getElementById('form-produto-title').textContent = 'Cadastrar Produto';
        document.getElementById('produto-ativo').checked = true;
        document.getElementById('produto-destaque').checked = false;
    },

    exportar: () => {
        const data = AppState.produtos.map(produto => ({
            ID: produto.id,
            Nome: produto.nome,
            Categoria: ProductManager.getCategoriaLabel(produto.categoria),
            Preço: produto.preco,
            'Tempo (min)': produto.tempo || 15,
            Descrição: produto.descricao || '',
            Status: produto.ativo ? 'Ativo' : 'Inativo',
            Destaque: produto.destaque ? 'Sim' : 'Não'
        }));

        const csv = ProductManager.convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `produtos_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        NotificationSystem.show('Produtos exportados com sucesso!', 'success');
    },

    convertToCSV: (data) => {
        if (!data.length) return '';
        
        const headers = Object.keys(data[0]);
        const csvContent = [
            headers.join(','),
            ...data.map(row => headers.map(header => `"${row[header]}"`).join(','))
        ].join('\n');
        
        return csvContent;
    }
};

// Continuar com os outros gerenciadores...
// (Devido ao limite de caracteres, vou continuar em uma próxima parte)

// Funções globais para compatibilidade
function showSection(sectionId) {
    Navigation.showSection(sectionId);
}

function toggleFormProduto() {
    ProductManager.toggleForm();
}

function toggleSidebar() {
    UI.toggleSidebar();
}

function atualizarDashboard() {
    Dashboard.atualizar();
}

function exportarProdutos() {
    ProductManager.exportar();
}

// Inicialização automática quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', SystemInit.initialize);
} else {
    SystemInit.initialize();
}

// ===== CONTINUAÇÃO DO SCRIPT MELHORADO - PARTE 2 =====

// Gerenciador de Pedidos
const OrderManager = {
    atualizarProximoNumero: () => {
        const proximoNumero = (AppState.pedidos.length + 1).toString().padStart(4, '0');
        const elemento = document.getElementById('proximo-numero');
        if (elemento) {
            elemento.textContent = `#${proximoNumero}`;
        }
    },

    toggleDeliveryInfo: () => {
        const tipo = document.getElementById('tipo-pedido')?.value;
        const deliveryInfo = document.getElementById('delivery-info');
        const linhaTaxa = document.getElementById('linha-taxa');
        
        if (deliveryInfo) {
            deliveryInfo.style.display = tipo === 'delivery' ? 'block' : 'none';
        }
        
        if (linhaTaxa) {
            linhaTaxa.style.display = tipo === 'delivery' ? 'block' : 'none';
        }
        
        OrderManager.calcularTotal();
    },

    adicionarItem: () => {
        const produtoId = parseInt(document.getElementById('produto-select')?.value);
        const quantidade = parseInt(document.getElementById('quantidade')?.value) || 1;
        const observacoes = document.getElementById('item-observacoes')?.value || '';

        if (!produtoId) {
            NotificationSystem.show('Selecione um produto!', 'error');
            return;
        }

        const produto = AppState.produtos.find(p => p.id === produtoId);
        if (!produto) {
            NotificationSystem.show('Produto não encontrado!', 'error');
            return;
        }

        // Verificar estoque
        const estoque = AppState.estoque[produtoId];
        if (estoque && estoque.quantidade < quantidade) {
            NotificationSystem.show(`Estoque insuficiente! Disponível: ${estoque.quantidade}`, 'warning');
            return;
        }

        const item = {
            id: produto.id,
            nome: produto.nome,
            preco: produto.preco,
            quantidade,
            observacoes,
            total: produto.preco * quantidade,
            tempo: produto.tempo || 15
        };

        AppState.pedidoAtual.itens.push(item);
        OrderManager.atualizarListaItens();
        OrderManager.limparSelecaoItem();
        
        NotificationSystem.show(`${produto.nome} adicionado ao pedido!`, 'success');
    },

    removerItem: (index) => {
        if (index >= 0 && index < AppState.pedidoAtual.itens.length) {
            const item = AppState.pedidoAtual.itens[index];
            AppState.pedidoAtual.itens.splice(index, 1);
            OrderManager.atualizarListaItens();
            NotificationSystem.show(`${item.nome} removido do pedido!`, 'info');
        }
    },

    atualizarListaItens: () => {
        const container = document.getElementById('itens-pedido');
        if (!container) return;

        if (AppState.pedidoAtual.itens.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-shopping-cart"></i>
                    <p>Nenhum item adicionado</p>
                </div>
            `;
            OrderManager.calcularTotal();
            return;
        }

        container.innerHTML = `
            <div class="itens-lista">
                ${AppState.pedidoAtual.itens.map((item, index) => `
                    <div class="item-pedido">
                        <div class="item-info">
                            <div class="item-nome">${item.nome}</div>
                            <div class="item-detalhes">
                                ${item.quantidade}x ${Utils.formatCurrency(item.preco)} = ${Utils.formatCurrency(item.total)}
                                ${item.observacoes ? `<br><small class="item-obs">Obs: ${item.observacoes}</small>` : ''}
                            </div>
                        </div>
                        <div class="item-actions">
                            <button class="btn-action edit" onclick="OrderManager.editarItem(${index})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-action delete" onclick="OrderManager.removerItem(${index})" title="Remover">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        OrderManager.calcularTotal();
    },

    calcularTotal: () => {
        const subtotal = AppState.pedidoAtual.itens.reduce((total, item) => total + item.total, 0);
        const tipo = document.getElementById('tipo-pedido')?.value;
        const taxaEntrega = tipo === 'delivery' ? parseFloat(document.getElementById('taxa-entrega')?.value || 0) : 0;
        const total = subtotal + taxaEntrega;

        AppState.pedidoAtual.subtotal = subtotal;
        AppState.pedidoAtual.taxaEntrega = taxaEntrega;
        AppState.pedidoAtual.total = total;

        // Atualizar interface
        const subtotalElement = document.getElementById('subtotal-pedido');
        if (subtotalElement) {
            subtotalElement.textContent = Utils.formatCurrency(subtotal);
        }

        const valorTaxaElement = document.getElementById('valor-taxa');
        if (valorTaxaElement) {
            valorTaxaElement.textContent = Utils.formatCurrency(taxaEntrega);
        }

        const totalElement = document.getElementById('total-pedido');
        if (totalElement) {
            totalElement.textContent = Utils.formatCurrency(total);
        }
    },

    finalizarPedido: (e) => {
        e.preventDefault();

        if (AppState.pedidoAtual.itens.length === 0) {
            NotificationSystem.show('Adicione pelo menos um item ao pedido!', 'error');
            return;
        }

        const cliente = document.getElementById('cliente-nome')?.value || 'Cliente Balcão';
        const tipo = document.getElementById('tipo-pedido')?.value;

        // Validações para delivery
        if (tipo === 'delivery') {
            const endereco = document.getElementById('endereco')?.value;
            const telefone = document.getElementById('telefone')?.value;

            if (!endereco || !telefone) {
                NotificationSystem.show('Preencha endereço e telefone para delivery!', 'error');
                return;
            }

            if (!Utils.isValidPhone(telefone)) {
                NotificationSystem.show('Telefone inválido!', 'error');
                return;
            }

            // Verificar valor mínimo
            if (AppState.pedidoAtual.subtotal < AppState.configuracoes.minimoDelivery) {
                NotificationSystem.show(
                    `Valor mínimo para delivery: ${Utils.formatCurrency(AppState.configuracoes.minimoDelivery)}`, 
                    'warning'
                );
                return;
            }
        }

        const pedido = {
            id: AppState.pedidos.length + 1,
            numero: `#${(AppState.pedidos.length + 1).toString().padStart(4, '0')}`,
            data: new Date(),
            cliente,
            tipo,
            itens: [...AppState.pedidoAtual.itens],
            subtotal: AppState.pedidoAtual.subtotal,
            taxaEntrega: AppState.pedidoAtual.taxaEntrega,
            total: AppState.pedidoAtual.total,
            status: 'novo',
            tempoEstimado: OrderManager.calcularTempoEstimado(),
            observacoes: document.getElementById('pedido-observacoes')?.value || ''
        };

        // Dados específicos do delivery
        if (tipo === 'delivery') {
            pedido.endereco = document.getElementById('endereco')?.value;
            pedido.telefone = document.getElementById('telefone')?.value;
            pedido.tempoEntrega = parseInt(document.getElementById('tempo-entrega')?.value) || AppState.configuracoes.tempoDelivery;
        }

        // Atualizar estoque
        pedido.itens.forEach(item => {
            if (AppState.estoque[item.id]) {
                AppState.estoque[item.id].quantidade -= item.quantidade;
                AppState.estoque[item.id].ultimaMovimentacao = new Date();
                AppState.estoque[item.id].movimentacoes.push({
                    tipo: 'saida',
                    quantidade: item.quantidade,
                    motivo: `Venda - Pedido ${pedido.numero}`,
                    data: new Date()
                });
            }
        });

        AppState.pedidos.push(pedido);
        Storage.save();

        // Mostrar comanda
        OrderManager.mostrarComanda(pedido);

        // Limpar formulário
        OrderManager.limparPedido();

        // Atualizar interface
        Dashboard.atualizar();
        OrderManager.atualizarLista();
        OrderManager.atualizarProximoNumero();

        // Notificação sonora
        NotificationSystem.playSound();
        NotificationSystem.show(`Pedido ${pedido.numero} finalizado com sucesso!`, 'success');
    },

    calcularTempoEstimado: () => {
        return AppState.pedidoAtual.itens.reduce((tempo, item) => {
            return Math.max(tempo, item.tempo * item.quantidade);
        }, 0);
    },

    mostrarComanda: (pedido) => {
        const content = document.getElementById('comanda-content');
        if (!content) return;

        content.innerHTML = `
            <div class="comanda-header">
                <h3>SABOREARTE LANCHES</h3>
                <p>${AppState.configuracoes.endereco}</p>
                <p>${AppState.configuracoes.telefone}</p>
                <hr>
                <p><strong>Comanda ${pedido.numero}</strong></p>
                <p>${Utils.formatDate(pedido.data)}</p>
            </div>
            <div class="comanda-items">
                <p><strong>Cliente:</strong> ${pedido.cliente}</p>
                <p><strong>Tipo:</strong> ${OrderManager.getTipoLabel(pedido.tipo)}</p>
                ${pedido.tipo === 'delivery' ? `
                    <p><strong>Endereço:</strong> ${pedido.endereco}</p>
                    <p><strong>Telefone:</strong> ${pedido.telefone}</p>
                    <p><strong>Tempo Estimado:</strong> ${pedido.tempoEntrega} min</p>
                ` : ''}
                ${pedido.observacoes ? `<p><strong>Observações:</strong> ${pedido.observacoes}</p>` : ''}
                <hr>
                <h4>ITENS:</h4>
                ${pedido.itens.map(item => `
                    <div class="comanda-item">
                        <span>${item.quantidade}x ${item.nome}</span>
                        <span>${Utils.formatCurrency(item.total)}</span>
                        ${item.observacoes ? `<br><small>Obs: ${item.observacoes}</small>` : ''}
                    </div>
                `).join('')}
                <hr>
                <div class="comanda-totais">
                    <div class="total-linha">
                        <span>Subtotal:</span>
                        <span>${Utils.formatCurrency(pedido.subtotal)}</span>
                    </div>
                    ${pedido.taxaEntrega > 0 ? `
                        <div class="total-linha">
                            <span>Taxa de Entrega:</span>
                            <span>${Utils.formatCurrency(pedido.taxaEntrega)}</span>
                        </div>
                    ` : ''}
                    <div class="total-linha total-final">
                        <span><strong>TOTAL:</strong></span>
                        <span><strong>${Utils.formatCurrency(pedido.total)}</strong></span>
                    </div>
                </div>
            </div>
            <div class="comanda-footer">
                <p>Tempo estimado: ${pedido.tempoEstimado} min</p>
                <p>Obrigado pela preferência!</p>
            </div>
        `;

        document.getElementById('modal-comanda')?.classList.add('active');
    },

    getTipoLabel: (tipo) => {
        const labels = {
            'balcao': '🏪 Balcão',
            'delivery': '🚚 Delivery',
            'retirada': '📦 Retirada'
        };
        return labels[tipo] || tipo;
    },

    limparPedido: () => {
        AppState.pedidoAtual = { itens: [], total: 0, subtotal: 0, taxaEntrega: 0 };
        document.getElementById('form-pedido')?.reset();
        document.getElementById('delivery-info').style.display = 'none';
        document.getElementById('linha-taxa').style.display = 'none';
        OrderManager.atualizarListaItens();
    },

    limparSelecaoItem: () => {
        document.getElementById('produto-select').value = '';
        document.getElementById('quantidade').value = '1';
        document.getElementById('item-observacoes').value = '';
    },

    atualizarLista: () => {
        const container = document.getElementById('lista-pedidos-dia');
        if (!container) return;

        const pedidosFiltrados = OrderManager.aplicarFiltros();

        if (pedidosFiltrados.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-receipt"></i>
                    <p>Nenhum pedido encontrado.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = pedidosFiltrados.map(pedido => `
            <div class="pedido-card" onclick="OrderManager.verDetalhes(${pedido.id})">
                <div class="pedido-header">
                    <span class="pedido-numero">${pedido.numero}</span>
                    <span class="pedido-status status-${pedido.status}">
                        ${Dashboard.getStatusLabel(pedido.status)}
                    </span>
                </div>
                <div class="pedido-info">
                    <p><strong>${pedido.cliente}</strong></p>
                    <p>${OrderManager.getTipoLabel(pedido.tipo)}</p>
                    <p>${pedido.itens.length} itens - ${Utils.formatCurrency(pedido.total)}</p>
                    <p class="pedido-tempo">${Utils.formatTimeAgo(pedido.data)}</p>
                </div>
                <div class="pedido-actions">
                    ${OrderManager.getAcoesPedido(pedido)}
                </div>
            </div>
        `).join('');
    },

    getAcoesPedido: (pedido) => {
        const acoes = [];

        if (pedido.status === 'novo') {
            acoes.push(`<button class="btn btn-warning btn-sm" onclick="OrderManager.iniciarPreparo(${pedido.id})">Iniciar Preparo</button>`);
        }

        if (pedido.status === 'preparando') {
            acoes.push(`<button class="btn btn-success btn-sm" onclick="OrderManager.marcarPronto(${pedido.id})">Marcar Pronto</button>`);
        }

        if (pedido.status === 'pronto' && pedido.tipo === 'delivery') {
            acoes.push(`<button class="btn btn-info btn-sm" onclick="DeliveryManager.iniciarEntrega(${pedido.id})">Iniciar Entrega</button>`);
        }

        if (pedido.status === 'em_rota') {
            acoes.push(`<button class="btn btn-success btn-sm" onclick="DeliveryManager.finalizarEntrega(${pedido.id})">Confirmar Entrega</button>`);
        }

        acoes.push(`<button class="btn btn-secondary btn-sm" onclick="OrderManager.mostrarComanda(${pedido.id})">Ver Comanda</button>`);

        if (pedido.status === 'novo' || pedido.status === 'preparando') {
            acoes.push(`<button class="btn btn-danger btn-sm" onclick="OrderManager.cancelarPedido(${pedido.id})">Cancelar</button>`);
        }

        return acoes.join(' ');
    },

    aplicarFiltros: () => {
        let pedidos = [...AppState.pedidos];

        // Filtro por status
        if (AppState.filtros.pedidos.status) {
            pedidos = pedidos.filter(p => p.status === AppState.filtros.pedidos.status);
        }

        // Filtro por tipo
        if (AppState.filtros.pedidos.tipo) {
            pedidos = pedidos.filter(p => p.tipo === AppState.filtros.pedidos.tipo);
        }

        // Filtro por data (hoje por padrão)
        const hoje = new Date().toDateString();
        pedidos = pedidos.filter(p => new Date(p.data).toDateString() === hoje);

        return pedidos.reverse(); // Mais recentes primeiro
    },

    filtrarPedidos: () => {
        const status = document.getElementById('filtro-status')?.value || '';
        const tipo = document.getElementById('filtro-tipo')?.value || '';

        AppState.filtros.pedidos = { status, tipo };
        OrderManager.atualizarLista();
    },

    verDetalhes: (id) => {
        const pedido = AppState.pedidos.find(p => p.id === id);
        if (pedido) {
            OrderManager.mostrarComanda(pedido);
        }
    },

    iniciarPreparo: (id) => {
        const pedido = AppState.pedidos.find(p => p.id === id);
        if (pedido) {
            pedido.status = 'preparando';
            pedido.inicioPreparacao = new Date();
            Storage.save();
            OrderManager.atualizarLista();
            KitchenManager.atualizarPainel();
            NotificationSystem.show(`Preparo do pedido ${pedido.numero} iniciado!`, 'info');
        }
    },

    marcarPronto: (id) => {
        const pedido = AppState.pedidos.find(p => p.id === id);
        if (pedido) {
            pedido.status = 'pronto';
            pedido.fimPreparacao = new Date();
            Storage.save();
            OrderManager.atualizarLista();
            KitchenManager.atualizarPainel();
            NotificationSystem.show(`Pedido ${pedido.numero} está pronto!`, 'success');
            NotificationSystem.playSound();
        }
    },

    cancelarPedido: (id) => {
        if (!confirm('Deseja realmente cancelar este pedido?')) return;

        const pedido = AppState.pedidos.find(p => p.id === id);
        if (pedido) {
            // Devolver itens ao estoque
            pedido.itens.forEach(item => {
                if (AppState.estoque[item.id]) {
                    AppState.estoque[item.id].quantidade += item.quantidade;
                    AppState.estoque[item.id].movimentacoes.push({
                        tipo: 'entrada',
                        quantidade: item.quantidade,
                        motivo: `Cancelamento - Pedido ${pedido.numero}`,
                        data: new Date()
                    });
                }
            });

            pedido.status = 'cancelado';
            pedido.dataCancelamento = new Date();
            Storage.save();
            OrderManager.atualizarLista();
            Dashboard.atualizar();
            NotificationSystem.show(`Pedido ${pedido.numero} cancelado!`, 'warning');
        }
    }
};

// Gerenciador da Cozinha
const KitchenManager = {
    atualizarPainel: () => {
        KitchenManager.atualizarEstatisticas();
        KitchenManager.atualizarPedidos();
    },

    atualizarEstatisticas: () => {
        const pedidosFila = AppState.pedidos.filter(p => p.status === 'novo').length;
        const pedidosPreparo = AppState.pedidos.filter(p => p.status === 'preparando').length;
        const pedidosAtrasados = AppState.pedidos.filter(p => {
            if (p.status !== 'preparando' && p.status !== 'novo') return false;
            const tempo = Math.floor((new Date() - new Date(p.data)) / 60000);
            return tempo > 20;
        }).length;

        // Calcular tempo médio
        const pedidosFinalizados = AppState.pedidos.filter(p => p.fimPreparacao);
        let tempoMedio = 0;
        if (pedidosFinalizados.length > 0) {
            const tempos = pedidosFinalizados.map(p => {
                const inicio = new Date(p.inicioPreparacao || p.data);
                const fim = new Date(p.fimPreparacao);
                return Math.floor((fim - inicio) / 60000);
            });
            tempoMedio = Math.floor(tempos.reduce((a, b) => a + b, 0) / tempos.length);
        }

        // Atualizar interface
        const elementos = {
            'pedidos-fila': pedidosFila,
            'pedidos-preparo': pedidosPreparo,
            'tempo-medio-preparo': tempoMedio,
            'pedidos-atrasados-count': pedidosAtrasados
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.textContent = valor;
            }
        });
    },

    atualizarPedidos: () => {
        const container = document.getElementById('kitchen-orders');
        if (!container) return;

        const pedidosCozinha = AppState.pedidos.filter(p => 
            p.status === 'novo' || p.status === 'preparando'
        );

        if (pedidosCozinha.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-fire"></i>
                    <p>Nenhum pedido em preparo no momento.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = pedidosCozinha.map(pedido => {
            const tempo = Math.floor((new Date() - new Date(pedido.data)) / 60000);
            const urgente = tempo > 20;
            const muitoUrgente = tempo > 30;

            return `
                <div class="kitchen-order ${urgente ? 'urgent' : ''} ${muitoUrgente ? 'very-urgent' : ''}">
                    <div class="order-header">
                        <h3>${pedido.numero}</h3>
                        <div class="order-timer ${urgente ? 'warning' : ''}">
                            ${tempo} min
                        </div>
                    </div>
                    <div class="order-info">
                        <p><strong>${pedido.cliente}</strong></p>
                        <p>${OrderManager.getTipoLabel(pedido.tipo)}</p>
                        ${pedido.tipo === 'delivery' ? `<p>📍 ${pedido.endereco}</p>` : ''}
                    </div>
                    <ul class="order-items">
                        ${pedido.itens.map(item => `
                            <li class="order-item">
                                <span class="item-qty">${item.quantidade}x</span>
                                <span class="item-name">${item.nome}</span>
                                ${item.observacoes ? `<small class="item-obs">Obs: ${item.observacoes}</small>` : ''}
                            </li>
                        `).join('')}
                    </ul>
                    <div class="order-actions">
                        ${pedido.status === 'novo' ? `
                            <button class="btn btn-warning btn-block" onclick="OrderManager.iniciarPreparo(${pedido.id})">
                                <i class="fas fa-play"></i> Iniciar Preparo
                            </button>
                        ` : `
                            <button class="btn btn-success btn-block" onclick="OrderManager.marcarPronto(${pedido.id})">
                                <i class="fas fa-check"></i> Marcar Pronto
                            </button>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    },

    toggleSom: () => {
        AppState.ui.somAtivo = !AppState.ui.somAtivo;
        const icon = document.getElementById('sound-icon');
        if (icon) {
            icon.className = AppState.ui.somAtivo ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        }
        NotificationSystem.show(
            `Som ${AppState.ui.somAtivo ? 'ativado' : 'desativado'}!`, 
            'info'
        );
    }
};

// Gerenciador de Estoque
const StockManager = {
    toggleForm: () => {
        const container = document.getElementById('form-estoque-container');
        const isVisible = container.style.display !== 'none';
        
        if (isVisible) {
            container.style.display = 'none';
            StockManager.limparForm();
        } else {
            container.style.display = 'block';
            document.getElementById('estoque-produto')?.focus();
        }
    },

    registrarMovimentacao: (e) => {
        e.preventDefault();

        const produtoId = parseInt(document.getElementById('estoque-produto').value);
        const quantidade = parseInt(document.getElementById('estoque-quantidade').value);
        const operacao = document.getElementById('estoque-operacao').value;
        const motivo = document.getElementById('estoque-motivo').value || 'Movimentação manual';

        if (!produtoId || !quantidade) {
            NotificationSystem.show('Preencha todos os campos obrigatórios!', 'error');
            return;
        }

        const produto = AppState.produtos.find(p => p.id === produtoId);
        if (!produto) {
            NotificationSystem.show('Produto não encontrado!', 'error');
            return;
        }

        // Inicializar estoque se não existir
        if (!AppState.estoque[produtoId]) {
            AppState.estoque[produtoId] = {
                quantidade: 0,
                minimo: AppState.configuracoes.estoqueMinimo,
                ultimaMovimentacao: new Date(),
                movimentacoes: []
            };
        }

        const estoque = AppState.estoque[produtoId];
        const quantidadeAnterior = estoque.quantidade;

        // Aplicar movimentação
        switch (operacao) {
            case 'entrada':
                estoque.quantidade += quantidade;
                break;
            case 'saida':
                if (estoque.quantidade < quantidade) {
                    NotificationSystem.show('Quantidade insuficiente em estoque!', 'error');
                    return;
                }
                estoque.quantidade -= quantidade;
                break;
            case 'ajuste':
                estoque.quantidade = quantidade;
                break;
        }

        // Registrar movimentação
        estoque.movimentacoes.push({
            tipo: operacao,
            quantidade: operacao === 'ajuste' ? quantidade - quantidadeAnterior : quantidade,
            quantidadeAnterior,
            quantidadeNova: estoque.quantidade,
            motivo,
            data: new Date()
        });

        estoque.ultimaMovimentacao = new Date();

        Storage.save();
        StockManager.atualizarLista();
        StockManager.atualizarEstatisticas();
        StockManager.toggleForm();

        NotificationSystem.show('Movimentação registrada com sucesso!', 'success');

        // Verificar alertas de estoque
        StockManager.verificarAlertas(produtoId);
    },

    verificarAlertas: (produtoId) => {
        const produto = AppState.produtos.find(p => p.id === produtoId);
        const estoque = AppState.estoque[produtoId];

        if (!produto || !estoque || !AppState.configuracoes.alertaEstoque) return;

        if (estoque.quantidade === 0) {
            NotificationSystem.show(`⚠️ ${produto.nome} está esgotado!`, 'error');
        } else if (estoque.quantidade <= estoque.minimo) {
            NotificationSystem.show(`⚠️ ${produto.nome} com estoque baixo!`, 'warning');
        }
    },

    atualizarLista: () => {
        const tbody = document.getElementById('lista-estoque');
        if (!tbody) return;

        const produtosComEstoque = AppState.produtos.filter(p => AppState.estoque[p.id]);
        const produtosFiltrados = StockManager.aplicarFiltros(produtosComEstoque);

        if (produtosFiltrados.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="empty-state">
                        <i class="fas fa-boxes"></i>
                        <p>Nenhum produto encontrado no estoque.</p>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = produtosFiltrados.map(produto => {
            const estoque = AppState.estoque[produto.id];
            const status = StockManager.getStatusEstoque(estoque);

            return `
                <tr class="estoque-row ${status.class}">
                    <td>
                        <div class="produto-info">
                            <strong>${produto.nome}</strong>
                            <small>${ProductManager.getCategoriaLabel(produto.categoria)}</small>
                        </div>
                    </td>
                    <td>${ProductManager.getCategoriaLabel(produto.categoria)}</td>
                    <td>
                        <span class="quantidade-atual ${status.class}">
                            ${estoque.quantidade}
                        </span>
                    </td>
                    <td>${estoque.minimo}</td>
                    <td>${Utils.formatDate(estoque.ultimaMovimentacao, { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>
                        <span class="status-badge ${status.class}">
                            ${status.label}
                        </span>
                    </td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn-action edit" onclick="StockManager.editarEstoque(${produto.id})" title="Editar">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-action history" onclick="StockManager.verHistorico(${produto.id})" title="Histórico">
                                <i class="fas fa-history"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    getStatusEstoque: (estoque) => {
        if (estoque.quantidade === 0) {
            return { class: 'esgotado', label: 'Esgotado' };
        } else if (estoque.quantidade <= estoque.minimo) {
            return { class: 'baixo', label: 'Estoque Baixo' };
        } else {
            return { class: 'normal', label: 'Normal' };
        }
    },

    atualizarEstatisticas: () => {
        let esgotados = 0;
        let baixo = 0;
        let normal = 0;

        AppState.produtos.forEach(produto => {
            const estoque = AppState.estoque[produto.id];
            if (estoque) {
                if (estoque.quantidade === 0) {
                    esgotados++;
                } else if (estoque.quantidade <= estoque.minimo) {
                    baixo++;
                } else {
                    normal++;
                }
            }
        });

        const elementos = {
            'produtos-esgotados': esgotados,
            'produtos-baixo': baixo,
            'produtos-ok': normal
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.textContent = valor;
            }
        });
    },

    aplicarFiltros: (produtos) => {
        let produtosFiltrados = [...produtos];

        // Filtro por status
        if (AppState.filtros.estoque.status) {
            produtosFiltrados = produtosFiltrados.filter(produto => {
                const estoque = AppState.estoque[produto.id];
                const status = StockManager.getStatusEstoque(estoque);
                return status.class === AppState.filtros.estoque.status;
            });
        }

        // Filtro por busca
        if (AppState.filtros.estoque.busca) {
            const busca = AppState.filtros.estoque.busca.toLowerCase();
            produtosFiltrados = produtosFiltrados.filter(produto =>
                produto.nome.toLowerCase().includes(busca)
            );
        }

        return produtosFiltrados;
    },

    filtrarEstoque: () => {
        const busca = document.getElementById('busca-estoque')?.value || '';
        const status = document.getElementById('filtro-status-estoque')?.value || '';

        AppState.filtros.estoque = { busca, status };
        StockManager.atualizarLista();
    },

    limparForm: () => {
        document.getElementById('form-estoque').reset();
    },

    editarEstoque: (produtoId) => {
        const produto = AppState.produtos.find(p => p.id === produtoId);
        const estoque = AppState.estoque[produtoId];

        if (!produto || !estoque) return;

        document.getElementById('estoque-produto').value = produtoId;
        document.getElementById('estoque-quantidade').value = estoque.quantidade;
        document.getElementById('estoque-operacao').value = 'ajuste';
        document.getElementById('estoque-motivo').value = 'Ajuste de inventário';

        StockManager.toggleForm();
    },

    verHistorico: (produtoId) => {
        const produto = AppState.produtos.find(p => p.id === produtoId);
        const estoque = AppState.estoque[produtoId];

        if (!produto || !estoque) return;

        // Implementar modal de histórico
        NotificationSystem.show(`Histórico de ${produto.nome} - ${estoque.movimentacoes.length} movimentações`, 'info');
    },

    exportar: () => {
        const data = AppState.produtos.map(produto => {
            const estoque = AppState.estoque[produto.id];
            const status = estoque ? StockManager.getStatusEstoque(estoque) : { label: 'Não cadastrado' };

            return {
                ID: produto.id,
                Produto: produto.nome,
                Categoria: ProductManager.getCategoriaLabel(produto.categoria),
                'Estoque Atual': estoque ? estoque.quantidade : 0,
                'Estoque Mínimo': estoque ? estoque.minimo : 0,
                Status: status.label,
                'Última Movimentação': estoque ? Utils.formatDate(estoque.ultimaMovimentacao) : '-'
            };
        });

        const csv = ProductManager.convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `estoque_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();

        NotificationSystem.show('Estoque exportado com sucesso!', 'success');
    }
};

// Gerenciador de Delivery
const DeliveryManager = {
    atualizar: () => {
        DeliveryManager.atualizarEstatisticas();
        DeliveryManager.atualizarLista();
    },

    atualizarEstatisticas: () => {
        const deliveries = AppState.pedidos.filter(p => p.tipo === 'delivery');
        const hoje = new Date().toDateString();

        const pendentes = deliveries.filter(p => p.status === 'pronto').length;
        const emRota = deliveries.filter(p => p.status === 'em_rota').length;
        const entreguesHoje = deliveries.filter(p => 
            p.status === 'entregue' && 
            new Date(p.data).toDateString() === hoje
        ).length;

        // Calcular tempo médio de entrega
        const entregasFinalizadas = deliveries.filter(p => p.dataEntrega);
        let tempoMedio = 0;
        if (entregasFinalizadas.length > 0) {
            const tempos = entregasFinalizadas.map(p => {
                const inicio = new Date(p.data);
                const fim = new Date(p.dataEntrega);
                return Math.floor((fim - inicio) / 60000);
            });
            tempoMedio = Math.floor(tempos.reduce((a, b) => a + b, 0) / tempos.length);
        }

        const elementos = {
            'delivery-pendentes': pendentes,
            'delivery-rota': emRota,
            'delivery-entregues': entreguesHoje,
            'tempo-medio-entrega': tempoMedio
        };

        Object.entries(elementos).forEach(([id, valor]) => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.textContent = valor;
            }
        });
    },

    atualizarLista: () => {
        const container = document.getElementById('lista-delivery');
        if (!container) return;

        const deliveriesFiltrados = DeliveryManager.aplicarFiltros();

        if (deliveriesFiltrados.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-truck"></i>
                    <p>Nenhum pedido de delivery encontrado.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = deliveriesFiltrados.map(pedido => `
            <div class="delivery-card">
                <div class="delivery-header">
                    <span class="pedido-numero">${pedido.numero}</span>
                    <span class="pedido-status status-${pedido.status}">
                        ${Dashboard.getStatusLabel(pedido.status)}
                    </span>
                </div>
                <div class="delivery-info">
                    <p><strong>${pedido.cliente}</strong></p>
                    <p><i class="fas fa-map-marker-alt"></i> ${pedido.endereco}</p>
                    <p><i class="fas fa-phone"></i> ${pedido.telefone}</p>
                    <p><i class="fas fa-clock"></i> ${Utils.formatTimeAgo(pedido.data)}</p>
                    <p><i class="fas fa-dollar-sign"></i> ${Utils.formatCurrency(pedido.total)}</p>
                </div>
                <div class="delivery-actions">
                    ${DeliveryManager.getAcoesDelivery(pedido)}
                </div>
            </div>
        `).join('');
    },

    getAcoesDelivery: (pedido) => {
        const acoes = [];

        if (pedido.status === 'pronto') {
            acoes.push(`
                <button class="btn btn-primary btn-sm" onclick="DeliveryManager.iniciarEntrega(${pedido.id})">
                    <i class="fas fa-truck"></i> Iniciar Entrega
                </button>
            `);
        }

        if (pedido.status === 'em_rota') {
            acoes.push(`
                <button class="btn btn-success btn-sm" onclick="DeliveryManager.finalizarEntrega(${pedido.id})">
                    <i class="fas fa-check"></i> Confirmar Entrega
                </button>
            `);
        }

        acoes.push(`
            <button class="btn btn-secondary btn-sm" onclick="OrderManager.verDetalhes(${pedido.id})">
                <i class="fas fa-eye"></i> Detalhes
            </button>
        `);

        return acoes.join(' ');
    },

    aplicarFiltros: () => {
        let deliveries = AppState.pedidos.filter(p => p.tipo === 'delivery');

        // Filtro por status
        if (AppState.filtros.delivery.status) {
            deliveries = deliveries.filter(p => p.status === AppState.filtros.delivery.status);
        }

        // Filtro por período
        const hoje = new Date();
        const ontem = new Date(hoje);
        ontem.setDate(hoje.getDate() - 1);

        switch (AppState.filtros.delivery.periodo) {
            case 'hoje':
                deliveries = deliveries.filter(p => 
                    new Date(p.data).toDateString() === hoje.toDateString()
                );
                break;
            case 'ontem':
                deliveries = deliveries.filter(p => 
                    new Date(p.data).toDateString() === ontem.toDateString()
                );
                break;
            case 'semana':
                const inicioSemana = new Date(hoje);
                inicioSemana.setDate(hoje.getDate() - hoje.getDay());
                deliveries = deliveries.filter(p => new Date(p.data) >= inicioSemana);
                break;
        }

        return deliveries.reverse(); // Mais recentes primeiro
    },

    filtrarDeliveries: () => {
        const status = document.getElementById('filtro-status-delivery')?.value || '';
        const periodo = document.getElementById('filtro-periodo-delivery')?.value || 'hoje';

        AppState.filtros.delivery = { status, periodo };
        DeliveryManager.atualizarLista();
    },

    iniciarEntrega: (id) => {
        const pedido = AppState.pedidos.find(p => p.id === id);
        if (pedido) {
            pedido.status = 'em_rota';
            pedido.inicioEntrega = new Date();
            Storage.save();
            DeliveryManager.atualizar();
            NotificationSystem.show(`Entrega ${pedido.numero} iniciada!`, 'info');
        }
    },

    finalizarEntrega: (id) => {
        const pedido = AppState.pedidos.find(p => p.id === id);
        if (pedido) {
            pedido.status = 'entregue';
            pedido.dataEntrega = new Date();
            Storage.save();
            DeliveryManager.atualizar();
            Dashboard.atualizar();
            NotificationSystem.show(`Entrega ${pedido.numero} finalizada!`, 'success');
        }
    }
};

// Interface do Usuário
const UI = {
    toggleSidebar: () => {
        const sidebar = document.querySelector('.sidebar');
        const mainContent = document.querySelector('.main-content');
        
        if (sidebar && mainContent) {
            sidebar.classList.toggle('collapsed');
            AppState.ui.sidebarCollapsed = !AppState.ui.sidebarCollapsed;
        }
    },

    closeAllModals: () => {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    },

    toggleFullscreen: () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
};

// Funções globais adicionais
function toggleMovimentacaoEstoque() {
    StockManager.toggleForm();
}

function atualizarEstoque() {
    // Compatibilidade com versão anterior
    const form = document.getElementById('form-estoque');
    if (form) {
        const event = new Event('submit');
        form.dispatchEvent(event);
    }
}

function atualizarPainelCozinha() {
    KitchenManager.atualizarPainel();
}

function atualizarDelivery() {
    DeliveryManager.atualizar();
}

function toggleSomNotificacao() {
    KitchenManager.toggleSom();
}

function exportarEstoque() {
    StockManager.exportar();
}

function alertasEstoque() {
    Navigation.showSection('dashboard');
    NotificationSystem.show('Verifique os alertas de estoque no Dashboard', 'info');
}

function fecharModal() {
    UI.closeAllModals();
}

function imprimirComanda() {
    window.print();
}

function alterarQuantidade(delta) {
    const input = document.getElementById('quantidade');
    if (input) {
        const valor = parseInt(input.value) + delta;
        input.value = Math.max(1, Math.min(99, valor));
    }
}

function adicionarItem() {
    OrderManager.adicionarItem();
}

function limparPedido() {
    OrderManager.limparPedido();
}

function finalizarPedido(e) {
    OrderManager.finalizarPedido(e);
}

function focusNovoPedido() {
    Navigation.showSection('pedidos');
    setTimeout(() => {
        document.getElementById('cliente-nome')?.focus();
    }, 100);
}

// Inicialização adicional para compatibilidade
document.addEventListener('DOMContentLoaded', function() {
    // Configurar máscaras de telefone
    const telefoneInputs = document.querySelectorAll('input[type="tel"]');
    telefoneInputs.forEach(input => {
        input.addEventListener('input', function(e) {
            e.target.value = Utils.phoneMask(e.target.value);
        });
    });

    // Configurar auto-atualização do painel da cozinha
    setInterval(() => {
        const currentSection = document.querySelector('.section.active');
        if (currentSection && currentSection.id === 'cozinha') {
            KitchenManager.atualizarPainel();
        }
    }, 30000); // A cada 30 segundos

    // Configurar auto-atualização do delivery
    setInterval(() => {
        const currentSection = document.querySelector('.section.active');
        if (currentSection && currentSection.id === 'delivery') {
            DeliveryManager.atualizar();
        }
    }, 60000); // A cada 1 minuto
});

