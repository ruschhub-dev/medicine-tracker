-- ============================================================
-- Catálogo inicial (aprovado, global). Rode DEPOIS de 03_rpc.sql.
-- São remédios comuns de casa, já aprovados (status='aprovado', familia_id=null),
-- para as famílias começarem sem precisar cadastrar do zero.
-- Ajuste/complemente à vontade. Códigos de barras ficam em branco de propósito —
-- cada um vai sendo preenchido conforme as pessoas escaneiam e você aprova.
-- ============================================================

insert into medicamentos
  (nome, principio_ativo, concentracao, forma, unidade, tarja, requer_receita, indicacao, status)
values
  ('Dipirona',            'Dipirona monoidratada',            '500 mg',      'comprimido', 'comprimidos', 'sem_tarja', false, 'Dor e febre',            'aprovado'),
  ('Dipirona gotas',      'Dipirona monoidratada',            '500 mg/mL',   'gotas',      'gotas',       'sem_tarja', false, 'Dor e febre',            'aprovado'),
  ('Paracetamol',         'Paracetamol',                      '750 mg',      'comprimido', 'comprimidos', 'sem_tarja', false, 'Dor e febre',            'aprovado'),
  ('Paracetamol gotas',   'Paracetamol',                      '200 mg/mL',   'gotas',      'gotas',       'sem_tarja', false, 'Dor e febre',            'aprovado'),
  ('Ibuprofeno',          'Ibuprofeno',                       '400 mg',      'comprimido', 'comprimidos', 'sem_tarja', false, 'Dor e inflamação',       'aprovado'),
  ('AAS',                 'Ácido acetilsalicílico',           '100 mg',      'comprimido', 'comprimidos', 'sem_tarja', false, 'Antiagregante / dor',    'aprovado'),
  ('Loratadina',          'Loratadina',                       '10 mg',       'comprimido', 'comprimidos', 'sem_tarja', false, 'Alergia',                'aprovado'),
  ('Cetirizina',          'Cetirizina',                       '10 mg',       'comprimido', 'comprimidos', 'sem_tarja', false, 'Alergia',                'aprovado'),
  ('Omeprazol',           'Omeprazol',                        '20 mg',       'capsula',    'capsulas',    'sem_tarja', false, 'Azia / gastrite',        'aprovado'),
  ('Buscopan',            'Butilbrometo de escopolamina',     '10 mg',       'comprimido', 'comprimidos', 'sem_tarja', false, 'Cólica / dor abdominal', 'aprovado'),
  ('Dorflex',             'Dipirona + orfenadrina + cafeína', '300+35+50 mg','comprimido', 'comprimidos', 'sem_tarja', false, 'Dor muscular',           'aprovado'),
  ('Nimesulida',          'Nimesulida',                       '100 mg',      'comprimido', 'comprimidos', 'sem_tarja', false, 'Dor e inflamação',       'aprovado'),
  ('Amoxicilina',         'Amoxicilina',                      '250 mg/5 mL', 'suspensao',  'ml',          'vermelha',  true,  'Antibiótico',            'aprovado'),
  ('Soro fisiológico',    'Cloreto de sódio 0,9%',            '0,9%',        'outro',      'ml',          'sem_tarja', false, 'Higiene nasal / lavagem','aprovado'),
  ('Vitamina C',          'Ácido ascórbico',                  '1 g',         'comprimido', 'comprimidos', 'sem_tarja', false, 'Suplemento',             'aprovado'),
  ('Vitamina D3',         'Colecalciferol',                   '2000 UI',     'capsula',    'capsulas',    'sem_tarja', false, 'Suplemento',             'aprovado'),
  ('Sais de reidratação', 'Sais para reidratação oral',       'sachê',       'outro',      'doses',       'sem_tarja', false, 'Reidratação',            'aprovado');
