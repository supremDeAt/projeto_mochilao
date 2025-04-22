const track = document.querySelector('.carousel-track');
const slides = Array.from(track.children);
const prevButton = document.querySelector('.prev');
const nextButton = document.querySelector('.next');

let currentSlideIndex = 0;

// Função para atualizar a posição do slide
function updateSlidePosition() {
  const slideWidth = slides[0].offsetWidth;
  track.style.transform = `translateX(-${currentSlideIndex * slideWidth}px)`;
}

// Botão "Avançar"
nextButton.addEventListener('click', () => {
  if (currentSlideIndex < slides.length - 1) {
    currentSlideIndex++;
    updateSlidePosition();
  }
});

// Botão "Voltar"
prevButton.addEventListener('click', () => {
  if (currentSlideIndex > 0) {
    currentSlideIndex--;
    updateSlidePosition();
  }
});

// Ajusta a posição dos slides ao redimensionar a janela
window.addEventListener('resize', () => {
  updateSlidePosition();
});