import React, { useState } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  Modal, 
  TouchableOpacity, 
  Dimensions, 
  Platform,
  ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function OnboardingModal({ visible, onClose }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "⚡ Добре дошли в WinBlitz!",
      icon: "flash",
      iconColor: "#fbbf24",
      desc: "WinBlitz е платформа за състезателни мини-игри, в които скоростта, паметта и умът определят победата. Това не е хазарт – всичко зависи единствено от Вашите лични умения!",
      highlight: "Всеки нов потребител започва с €100.00 демо бонус!"
    },
    {
      title: "🏆 Два режима на игра",
      icon: "trophy",
      iconColor: "#fbbf24",
      desc: "• Тренировъчен режим (Practice): Играете напълно безплатно срещу симулирани ботове, трупате опит (+10 XP) и тренирате бързината си.\n\n• Реални турнири: Влизате със скромна такса вход и играете за ценни материални или парични награди.",
      highlight: "Колкото по-бързо играете, толкова по-голям е шансът за победа!"
    },
    {
      title: "🧠 5-те Блиц игри",
      icon: "brain-outline",
      iconColor: "#8b5cf6",
      desc: "Ще се състезавате в 5 случайни дисциплини:\n\n• 🧮 Математика: Бързо решаване на задачи.\n• 🃏 Карти за памет: Намиране на еднакви двойки.\n• 🎯 Рефлекс бутон: Реакция при цвят зелено.\n• 🔤 Разбъркани букви: Сглобяване на дума.\n• 🔢 Подреди числата: Натискане от 1 до 9.",
      highlight: "Внимавайте! Всяка грешка добавя наказателно време от +3 секунди!"
    },
    {
      title: "👑 XP, Лиги и Кланове",
      icon: "ribbon-outline",
      iconColor: "#d946ef",
      desc: "• С всяка изиграна игра събирате опит (XP) и качвате ниво.\n• Прогресирате през 4 лиги: Бронз 🥉, Сребро 🥈, Злато 🥇 и Елит 👑.\n• Можете да се присъедините към Клан и да трупате общо XP за Вашия отбор.",
      highlight: "Отключвайте уникални аватари и неонови теми в Магазина!"
    },
    {
      title: "🎁 Автоматична доставка",
      icon: "gift-outline",
      iconColor: "#10b981",
      desc: "Когато спечелите реален турнир, физическата награда (напр. кафемашина Krups, комплект чаши за еспресо и др.) автоматично се адресира и изпраща с безплатна куриерска доставка (Спиди/Еконт) до Вашите данни за доставка.",
      highlight: "Можете да редактирате адреса си по всяко време от таб 'Профил'!"
    },
    {
      title: "🎡 Дневен бонус & Куестове",
      icon: "star-outline",
      iconColor: "#fbbf24",
      desc: "• Daily Quests: Изпълнявайте ежедневните задачи (напр. изиграване на 2 тренировки) и прибирайте директно парични награди.\n• Lucky Wheel: Въртете безплатното Колело на Късмета на всеки 24 часа за гарантирани бонуси.",
      highlight: "Имате ли въпроси? Нашите администратори са на разположение!"
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 0.5 * 2); // Prev slide
    }
  };

  const handleClose = () => {
    setCurrentSlide(0);
    if (onClose) onClose();
  };

  const activeSlide = slides[currentSlide];

  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Progress Indicators */}
          <View style={styles.indicatorContainer}>
            {slides.map((_, index) => (
              <View 
                key={index} 
                style={[
                  styles.indicator, 
                  index === currentSlide && styles.indicatorActive,
                  index < currentSlide && styles.indicatorPassed
                ]} 
              />
            ))}
          </View>

          {/* Icon Header */}
          <View style={[styles.iconWrapper, { borderColor: activeSlide.iconColor }]}>
            <Ionicons name={activeSlide.icon} size={48} color={activeSlide.iconColor} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{activeSlide.title}</Text>

          {/* Slogan details */}
          <Text style={styles.subtitle}>РЪКОВОДСТВО ЗА ПОТРЕБИТЕЛЯ</Text>

          {/* Content Scroll View */}
          <ScrollView style={styles.contentContainer} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={true}>
            <Text style={styles.descText}>{activeSlide.desc}</Text>
            
            {activeSlide.highlight ? (
              <View style={styles.highlightBox}>
                <Ionicons name="information-circle-outline" size={18} color="#fbbf24" style={{ marginRight: 6 }} />
                <Text style={styles.highlightText}>{activeSlide.highlight}</Text>
              </View>
            ) : null}
          </ScrollView>

          {/* Footer Navigation Buttons */}
          <View style={styles.footerRow}>
            {currentSlide > 0 ? (
              <TouchableOpacity style={styles.backBtn} onPress={handlePrev}>
                <Text style={styles.backBtnText}>Назад</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            <TouchableOpacity style={styles.nextBtn} onPress={handleNext}>
              <Text style={styles.nextBtnText}>
                {currentSlide === slides.length - 1 ? "Започни играта! 🚀" : "Напред"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Quick Exit Header Cross */}
          <TouchableOpacity style={styles.closeCross} onPress={handleClose}>
            <Ionicons name="close" size={24} color="#52525b" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 5, 27, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#140e34',
    borderWidth: 2,
    borderColor: '#8b5cf6',
    borderRadius: 24,
    width: width * 0.9,
    maxHeight: height * 0.85,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#d946ef',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 10,
  },
  indicatorContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    width: '100%',
    justifyContent: 'center',
  },
  indicator: {
    height: 4,
    flex: 1,
    backgroundColor: '#2e2b3e',
    marginHorizontal: 3,
    borderRadius: 2,
  },
  indicatorActive: {
    backgroundColor: '#d946ef',
  },
  indicatorPassed: {
    backgroundColor: '#8b5cf6',
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(20, 14, 52, 0.6)',
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 9,
    color: '#a1a1aa',
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  contentContainer: {
    width: '100%',
    marginVertical: 10,
    flexShrink: 1, // Ensures content is scrollable and automatically fits inside container bounds
  },
  descText: {
    fontSize: 14,
    color: '#d4d4d8',
    lineHeight: 22,
    textAlign: 'left',
  },
  highlightBox: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.3)',
    borderRadius: 8,
    padding: 12,
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  highlightText: {
    fontSize: 12,
    color: '#fbbf24',
    fontWeight: '600',
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    width: '100%',
    marginTop: 16,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
  },
  backBtnText: {
    color: '#a1a1aa',
    fontSize: 16,
    fontWeight: '600',
  },
  nextBtn: {
    flex: 1.5,
    backgroundColor: '#8b5cf6',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  nextBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeCross: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 8,
  }
});
