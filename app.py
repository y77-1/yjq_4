from flask import Flask, request, jsonify, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
from flask_cors import CORS
import os

app = Flask(__name__, static_folder='static', static_url_path='')
CORS(app)
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///game.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# 确保 instance 文件夹存在
if not os.path.exists('instance'):
    os.makedirs('instance')

db = SQLAlchemy(app)

# 添加 data 文件夹路由
@app.route('/data/<path:filename>')
def serve_data(filename):
    return send_from_directory('data', filename)

# 添加 audio 文件路由
@app.route('/data/audio/<path:filename>')
def serve_audio(filename):
    try:
        return send_from_directory('data/audio', filename)
    except Exception as e:
        app.logger.error(f'音频文件访问错误: {str(e)}')
        return jsonify({'error': '音频文件不存在'}), 404

# 玩家模型
class Player(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    nickname = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    scores = db.relationship('Score', backref='player', lazy=True)

# 分数模型
class Score(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    player_id = db.Column(db.String(50), db.ForeignKey('player.id'), nullable=False)
    score = db.Column(db.Integer, default=0)
    items = db.Column(db.String(200))  # 存储收集的物品
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)

# 创建数据库表
with app.app_context():
    db.create_all()

@app.route('/api/player', methods=['POST'])
def create_player():
    try:
        data = request.json
        if not data or 'id' not in data or 'nickname' not in data:
            return jsonify({'error': '缺少必要的数据'}), 400
            
        # 检查玩家是否已存在
        existing_player = Player.query.get(data['id'])
        if existing_player:
            return jsonify({
                'message': '玩家已存在',
                'id': existing_player.id,
                'nickname': existing_player.nickname
            }), 200
            
        # 创建新玩家
        player = Player(id=data['id'], nickname=data['nickname'])
        db.session.add(player)
        db.session.commit()
        return jsonify({
            'message': '玩家创建成功',
            'id': player.id,
            'nickname': player.nickname
        })
    except Exception as e:
        db.session.rollback()
        app.logger.error(f'创建玩家失败: {str(e)}')
        return jsonify({'error': '创建玩家失败，请重试'}), 500

@app.route('/api/player/<player_id>', methods=['GET'])
def get_player(player_id):
    player = Player.query.get_or_404(player_id)
    scores = [{'score': s.score, 'items': s.items, 'completed_at': s.completed_at.isoformat()} 
             for s in player.scores]
    return jsonify({
        'id': player.id,
        'nickname': player.nickname,
        'scores': scores
    })

@app.route('/api/score', methods=['POST'])
def add_score():
    data = request.json
    score = Score(
        player_id=data['player_id'],
        score=data['score'],
        items=','.join(data['items'])
    )
    db.session.add(score)
    db.session.commit()
    return jsonify({'message': '分数记录成功'})

@app.route('/')
def index():
    return app.send_static_file('login.html')

@app.route('/game')
def game():
    return app.send_static_file('game.html')

@app.route('/images/items/<path:filename>')
def serve_item_images(filename):
    return send_from_directory('static/images/items', filename)

if __name__ == '__main__':
    app.run(debug=True) 