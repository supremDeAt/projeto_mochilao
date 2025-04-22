function toggleMenu() {
  document.getElementById('sidebar').classList.toggle('show-menu');
}

/*CONTADOR*/

function iniciarContadores() {
  const contadores = document.querySelectorAll('.numero');
  contadores.forEach(contador => {
    const alvo = +contador.getAttribute('data-alvo');
    let contagem = 0;
    const incremento = alvo / 100;

    const atualizar = () => {
      contagem += incremento;
      if (contagem < alvo) {
        contador.textContent = Math.ceil(contagem);
        requestAnimationFrame(atualizar);
      } else {
        contador.textContent = alvo;
      }
    };

    atualizar();
  });
}

let iniciado = false;

window.addEventListener('scroll', () => {
  const secao = document.getElementById('contadores');
  const secaoTopo = secao.getBoundingClientRect().top;
  const janelaAltura = window.innerHeight;

  if (secaoTopo < janelaAltura && !iniciado) {
    iniciarContadores();
    iniciado = true;
  }
});


